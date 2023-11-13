# Janky MV3 RES Fork

Forked from [honestbleeps/Reddit-Enhancement-Suite](https://github.com/honestbleeps/Reddit-Enhancement-Suite), including:

* Convert codebase from Flow to TypeScript
* Upgrade from Webpack 4 to 5
* Get rid of Babel for bundling, use esbuild instead
* MV3 fixes
* Merge branch [honestbleeps/Reddit-Enhancement-Suite/ghact](https://github.com/honestbleeps/Reddit-Enhancement-Suite/tree/ghact)
* Merge PR [honestbleeps/Reddit-Enhancement-Suite/5475](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5475) Update showImages.js to fix google reverse image search URL
* Merge PR [honestbleeps/Reddit-Enhancement-Suite/5481](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5481) fix redgif host video and images
* Merge PR [honestbleeps/Reddit-Enhancement-Suite/5478](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5478) Fix: download images from posts with emoji-only, extra long, exotic emoji containing titles
* Merge PR [honestbleeps/Reddit-Enhancement-Suite/5476](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5476) Add support for twitter e𝕏pandos on 𝕏.com links (twitter rename)
* Merge PR [honestbleeps/Reddit-Enhancement-Suite/5453](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5453) Bump jszip from 2.7.0 to 3.8.0
* Merge branch [honestbleeps/Reddit-Enhancement-Suite/dependabot/npm_and_yarn/postcss-8.4.31](https://github.com/honestbleeps/Reddit-Enhancement-Suite/tree/dependabot/npm_and_yarn/postcss-8.4.31)
* Merge branch [honestbleeps/Reddit-Enhancement-Suite/dependabot/npm_and_yarn/babel/traverse-7.23.2](https://github.com/honestbleeps/Reddit-Enhancement-Suite/tree/dependabot/npm_and_yarn/babel/traverse-7.23.2)
* Merge branch [honestbleeps/Reddit-Enhancement-Suite/dependabot/npm_and_yarn/browserify-sign-4.2.2](https://github.com/honestbleeps/Reddit-Enhancement-Suite/tree/dependabot/npm_and_yarn/browserify-sign-4.2.2)
* Merge PR [honestbleeps/Reddit-Enhancement-Suite/5403](https://github.com/honestbleeps/Reddit-Enhancement-Suite/pull/5403) Manifest v3 Support

## What works

* You tell me

## What doesn't work

* Message passing between background and foreground script

# Original readme

[![RES Pipeline](https://github.com/honestbleeps/Reddit-Enhancement-Suite/actions/workflows/pipeline.yml/badge.svg)](https://github.com/honestbleeps/Reddit-Enhancement-Suite/actions/workflows/pipeline.yml)
[![Chat on Discord](https://img.shields.io/discord/681993947085799490?label=Discord)](https://discord.gg/UzkFNNa)

## [Please read this post before continuing.](https://www.reddit.com/r/RESAnnouncements/comments/sh83gx/announcement_life_of_reddit_enhancement_suite/)

Reddit Enhancement Suite (RES) is a suite of modules that enhances your Reddit browsing experience.
For general documentation, visit the [Reddit Enhancement Suite Wiki](https://www.reddit.com/r/Enhancement/wiki/index).

## Introduction

Hi there! Thanks for checking out RES on GitHub. A few important notes:

1. RES is licensed under GPLv3, which means you're technically free to do whatever you wish in terms of redistribution as long as you maintain GPLv3 licensing. However, I ask out of courtesy that should you choose to release your own, separate distribution of RES, you please name it something else entirely. Unfortunately, I have run into problems in the past with people redistributing under the same name, and causing me tech support headaches.

2. I ask that you please do not distribute your own binaries of RES (e.g. with bugfixes, etc). The version numbers in RES are important references for tech support so that we can replicate bugs that users report using the same version they are, and when you distribute your own - you run the risk of polluting/confusing that. In addition, if a user overwrites his/her extension with your distributed copy, it may not properly retain their RES settings/data depending on the developer ID used, etc.

I can't stop you from doing any of this. I'm just asking out of courtesy because I already spend a great deal of time providing tech support and chasing down bugs, and it's much harder when people think I'm the support guy for a separate branch of code.

Thanks!

Steve Sobel
steve@honestbleeps.com

## Building and contributing

See [CONTRIBUTING.md](/CONTRIBUTING.md).

## License

See [LICENSE](/LICENSE).

## Changelog

See the [`changelog/`](/changelog) directory for individual versions or https://redditenhancementsuite.com/releases/ for all versions.
