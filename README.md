![Logo](https://raw.githubusercontent.com/Zefau/ioBroker.plex/master/admin/plex.jpg)
# ioBroker.plex
Integration of the Plex Media Server in ioBroker (with or without Plex Pass). Furthermore, Tautulli integration.

![Number of Installations](http://iobroker.live/badges/plex-installed.svg) ![Stable version](http://iobroker.live/badges/plex-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.plex.svg)](https://www.npmjs.com/package/iobroker.plex)
[![Travis CI](https://travis-ci.org/Zefau/ioBroker.plex.svg?branch=master)](https://travis-ci.org/Zefau/ioBroker.plex)
[![Downloads](https://img.shields.io/npm/dm/iobroker.plex.svg)](https://www.npmjs.com/package/iobroker.plex)
[![Greenkeeper badge](https://badges.greenkeeper.io/Zefau/ioBroker.plex.svg)](https://greenkeeper.io/)

[![NPM](https://nodei.co/npm/iobroker.plex.png?downloads=true)](https://nodei.co/npm/iobroker.plex/) 


**Table of contents**
1. Setup instructions
   1. API settings
2. tbd
3. Changelog
4. Licence


## Setup instructions
### Basic Setup
tbd

### Advanced Setup (Plex Pass or Tautulli)
#### Plex Pass
tbd

#### Tautulli
[Tautulli is a 3rd party application](https://tautulli.com/#about) that you can run alongside your Plex Media Server to monitor activity and track various statistics. Most importantly, these statistics include what has been watched, who watched it, when and where they watched it, and how it was watched. All statistics are presented in a nice and clean interface with many tables and graphs, which makes it easy to brag about your server to everyone else. Check out [Tautulli Preview](https://tautulli.com/#preview) and [install it on your preferred system](https://github.com/Tautulli/Tautulli-Wiki/wiki/Installation) if you are interested.

This adapter connects to the [Tautulli API](https://github.com/Tautulli/Tautulli/blob/master/API.md) and also receives webhook events from Tautulli.

Once Tautulli is installed, open the _Settings_ page from Tautulli dashboard and navigate to _Web Interface_. Scroll down to the _API_ section and make sure ```Enable API``` is checked. Copy the ```API key``` and enter it in the ioBroker.plex settings. Furthermore, add the Tautulli IP address and port to allow API communication.


## Channels & States
###  With Basis Setup
After sucessful basic setup the following channels and states will be created:

| Channel | Folder | State | Description |
| ------- | ------ | ----- | ----------- |
| tbd | - | - | tbd |

###  With Advanced Setup
After sucessful advanced setup the following channels and states will _additionally_ be created:

| Channel | Folder | State | Description | Remark |
| ------- | ------ | ----- | ----------- | ------ |
| tbd | - | - | tbd | with Plex Pass or Tautulli |
| tbd | - | - | tbd | only with Tautulli |


## Changelog

### 0.1.0 (2019-04-18)
* (zefau) initial release


## License
The MIT License (MIT)

Copyright (c) 2019 Zefau <zefau@mailbox.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
