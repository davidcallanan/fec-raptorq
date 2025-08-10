# UOE (Utils of Essence)

This project is a collection of JavaScript utilities that I use throughout my projects. Many of these utilities attempt to make JavaScript behave more like my dream language (Essence), which has a strong focus on original architectural research. Additionally, syntax for this language is patched into JavaScript, found in the `ec` folder.

Documentation can be found at [https://uoe.dcallanan.com/](https://uoe.dcallanan.com/).

This code is rapidly updated and kept in lockstep with my own private projects. This is a double-edged sword, as it means the code is highly tested in production, but also means the code is highly unstable as I am constantly revising and rethinking my architectural approach.

This project is gradually incorporating years of architectural research started in 2018, that has only just now reached a point suitable for use.

The recommended way to use this project is to setup a git submodule in your project, and then directly import the utilities you need. Some code is written in TypeScript, so it's best to use this in a TypeScript-compatible toolchain.
