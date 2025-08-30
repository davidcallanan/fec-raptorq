use clap::Parser;
use std::io::{self, Read, Write};
use anyhow::{Result, Context, bail};
use raptorq::{Encoder, Decoder, EncodingPacket, ObjectTransmissionInformation};

// Conditional logging macro - only logs when "verbose-logging" feature is enabled
macro_rules! log_info {
    ($($arg:tt)*) => {
        #[cfg(feature = "verbose-logging")]
        eprintln!($($arg)*);
    };
}

/// RFC6330 compliant RaptorQ encoder/decoder
/// 
/// This implementation properly handles:
/// - ObjectTransmissionInformation (OTI) as per section 3.3 of RFC6330
///   * The encoder ALWAYS generates and includes the OTI header
///   * The decoder READS the OTI to understand how to process packets  
///   * Transfer length (F parameter) is automatically determined from input data during encoding
/// - Encoding packets with fixed-size structure: PayloadId (4 bytes) + symbol data (symbol_size bytes)
/// - Clean binary output: OTI header (12 bytes) + concatenated packets
/// 
/// Key insight: Each packet has a FIXED size (4 + symbol_size bytes), so they can be
/// safely concatenated. The decoder calculates packet count from: (total_size - 12) / packet_size
/// 
/// No manual length specification needed - encoding determines from stdin, decoding reads from OTI!

#[derive(Parser)]
#[command(name = "raptorq")]
#[command(about = "RaptorQ forward error correction CLI tool")]
#[command(version)]
struct Args {
    #[arg(long, conflicts_with = "decode", help = "Encode data from stdin")]
    encode: bool,
    
    #[arg(long, conflicts_with = "encode", help = "Decode data from stdin (reads all parameters from OTI header)")]
    decode: bool,
    
    // Encoding-only parameters (ignored during decoding - OTI is used instead)
    #[arg(long, default_value = "1400", help = "Size of each symbol in bytes (MTU) - ENCODING ONLY")]
    symbol_size: u16,
    
    #[arg(long, default_value = "15", help = "Number of repair symbols per source block - ENCODING ONLY")]
    repair_symbols: u32,
    
    #[arg(long, default_value = "1", help = "Number of source blocks - ENCODING ONLY")]
    source_blocks: u8,
    
    #[arg(long, default_value = "1", help = "Number of sub-blocks per source block - ENCODING ONLY")]
    sub_blocks: u16,
    
    #[arg(long, default_value = "8", help = "Symbol alignment in bytes (must be > 0) - ENCODING ONLY")]
    symbol_alignment: u8,
}

fn main() -> Result<()> {
    let args = Args::parse();
    
    // Validate that either encode or decode is specified
    if !args.encode && !args.decode {
        bail!("Either --encode or --decode must be specified");
    }
    
    // Validate symbol alignment
    if args.symbol_alignment == 0 {
        bail!("Symbol alignment must be greater than 0");
    }
    
    // Validate symbol size alignment
    if args.symbol_size % args.symbol_alignment as u16 != 0 {
        bail!("Symbol size must be divisible by symbol alignment");
    }
    
    if args.encode {
        encode_data(&args)
    } else {
        decode_data(&args)
    }
}

fn encode_data(args: &Args) -> Result<()> {
    // Read input data from stdin
    let mut input_data = Vec::new();
    io::stdin().read_to_end(&mut input_data)
        .context("Failed to read from stdin")?;
    
    if input_data.is_empty() {
        bail!("No input data received from stdin");
    }

    // Create encoder - use defaults with user overrides
    // Transfer length is automatically determined from input data size
    let transfer_length = input_data.len() as u64;
    let config = ObjectTransmissionInformation::new(
        transfer_length,
        args.symbol_size,
        args.source_blocks,
        args.sub_blocks,
        args.symbol_alignment,
    );
    let encoder = Encoder::new(&input_data, config);

    // Output OTI header immediately (12 bytes as per RFC6330)
    // This allows the decoder to automatically determine all encoding parameters
    let oti = config.serialize();
    io::stdout().write_all(&oti)
        .context("Failed to write OTI header to stdout")?;
    
    log_info!("Starting streaming encode - outputting packets as they're generated...");
    
    // Stream encoded packets as they're generated (no buffering)
    let mut total_packets = 0;
    let mut stdout = io::stdout();
    
    for (block_idx, block_encoder) in encoder.get_block_encoders().iter().enumerate() {
        log_info!("Processing source block {} of {}", block_idx + 1, encoder.get_block_encoders().len());
        
        // Stream source packets immediately
        let source_packets = block_encoder.source_packets();
        let source_packet_count = source_packets.len(); // Store length before move
        for packet in source_packets {
            let serialized = packet.serialize();
            stdout.write_all(&serialized)
                .context("Failed to write source packet to stdout")?;
            total_packets += 1;
        }
        
        // Stream repair packets in batches to avoid memory buildup
        let repair_batch_size = 50; // Process repair packets in smaller batches
        let mut repair_start = 0;
        
        while repair_start < args.repair_symbols {
            let batch_size = std::cmp::min(repair_batch_size, args.repair_symbols - repair_start);
            let repair_packets = block_encoder.repair_packets(repair_start, batch_size);
            
            for packet in repair_packets {
                let serialized = packet.serialize();
                stdout.write_all(&serialized)
                    .context("Failed to write repair packet to stdout")?;
                total_packets += 1;
            }
            
            repair_start += batch_size;
            log_info!("  → Generated {} repair packets so far", repair_start);
        }
        
        // Ensure packets are written immediately
        stdout.flush().context("Failed to flush stdout")?;
        log_info!("✓ Completed source block {} ({} packets)", block_idx + 1, 
            source_packet_count + args.repair_symbols as usize);
    }
    
    log_info!("✓ Successfully encoded {} bytes into {} packets (streamed output)", 
        input_data.len(), total_packets);
    Ok(())
}

fn decode_data(args: &Args) -> Result<()> {
    let mut stdin = io::stdin();
    
    // First, read the OTI header (12 bytes) from stdin
    let mut oti_buffer = [0u8; 12];
    stdin.read_exact(&mut oti_buffer)
        .context("Failed to read OTI header from stdin")?;

    // Parse ObjectTransmissionInformation (OTI) from stream
    let config = ObjectTransmissionInformation::deserialize(&oti_buffer);
    
    log_info!("Using OTI from stream:");
    log_info!("  transfer_length: {} bytes", config.transfer_length());
    log_info!("  symbol_size: {} bytes", config.symbol_size());
    log_info!("  source_blocks: {}", config.source_blocks());
    log_info!("  sub_blocks: {}", config.sub_blocks());
    log_info!("  symbol_alignment: {}", config.symbol_alignment());
    
    // Calculate packet size
    // Each packet = PayloadId (4 bytes) + symbol data (symbol_size bytes)
    let packet_size = 4 + config.symbol_size() as usize;
    log_info!("Each packet is {} bytes (4 byte PayloadId + {} byte symbol)", 
        packet_size, config.symbol_size());
    log_info!("Output format: blocks (always - SBN-prefixed for concurrency)");
    
    // Create a single decoder that handles all source blocks internally
    let mut decoder = Decoder::new(config);
    let mut blocks_completed = 0;
    let total_blocks = config.source_blocks() as usize;
    
    log_info!("Starting decoding for {} source blocks...", config.source_blocks());
    
    let mut packets_processed = 0;
    let mut packet_buffer = vec![0u8; packet_size];
    
    loop {
        // Try to read exactly one packet from stdin
        match stdin.read_exact(&mut packet_buffer) {
            Ok(()) => {
                packets_processed += 1;
                
                // Deserialize the packet to get SBN
                let packet = EncodingPacket::deserialize(&packet_buffer);
                let payload_id = packet.payload_id();
                let sbn = payload_id.source_block_number();
                
                log_info!("Received packet {} for source block {} ({} bytes)", 
                    packets_processed, sbn, packet_size);
                
                // Try to decode this specific block - output immediately if it completes
                if let Some((block_sbn, block_data)) = decoder.try_decode_block(packet) {
                    // This block just completed! Output it immediately
                    blocks_completed += 1;
                    
                    // Output: SBN (1 byte) + Block Size (4 bytes, little-endian) + block data
                    let mut output = Vec::with_capacity(1 + 4 + block_data.len());
                    output.push(block_sbn);
                    
                    // Write block size as 4-byte little-endian u32
                    let block_size = block_data.len() as u32;
                    output.extend_from_slice(&block_size.to_le_bytes());
                    output.extend_from_slice(&block_data);
                    
                    io::stdout().write_all(&output)
                        .context("Failed to write decoded block to stdout")?;
                    io::stdout().flush()
                        .context("Failed to flush stdout")?;
                        
                    log_info!("✓ Successfully decoded source block {} ({} bytes) using {} total packets", 
                        block_sbn, block_data.len(), packets_processed);
                        
                    // Check if all blocks are now complete
                    if blocks_completed == total_blocks {
                        log_info!("✓ All {} source blocks completed!", total_blocks);
                        return Ok(());
                    }
                } else {
                    // Block not yet complete, need more packets
                    log_info!("  → Block {} needs more packets...", sbn);
                }
            }
            Err(ref e) if e.kind() == io::ErrorKind::UnexpectedEof => {
                // End of stream - no more packets available
                log_info!("End of stream reached after {} packets", packets_processed);
                bail!("Failed to decode: stream ended before all blocks could be decoded");
            }
            Err(e) => {
                bail!("Failed to read packet {} from stdin: {}", packets_processed + 1, e);
            }
        }
    }
}
