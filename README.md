![Logo](https://raw.githubusercontent.com/Zefau/ioBroker.plex/master/admin/plex.jpg)
# ioBroker.plex
Integration of the Plex Media Server in ioBroker (with or without Plex Pass). Furthermore, Tautulli integration.

![Number of Installations](http://iobroker.live/badges/plex-installed.svg) ![Stable version](http://iobroker.live/badges/plex-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.plex.svg)](https://www.npmjs.com/package/iobroker.plex)
[![Travis CI](https://travis-ci.org/Zefau/ioBroker.plex.svg?branch=master)](https://travis-ci.org/Zefau/ioBroker.plex)
[![Downloads](https://img.shields.io/npm/dm/iobroker.plex.svg)](https://www.npmjs.com/package/iobroker.plex)
[![Greenkeeper badge](https://badges.greenkeeper.io/Zefau/ioBroker.plex.svg)](https://greenkeeper.io/)

[![NPM](https://nodei.co/npm/iobroker.plex.png?downloads=true)](https://nodei.co/npm/iobroker.plex/) 


**Table of contents**
1. [Setup instructions](https://github.com/Zefau/ioBroker.plex#setup-instructions)
   1. [Basic setup](https://github.com/Zefau/ioBroker.plex#basic-setup)
   2. [Advanced Setup](https://github.com/Zefau/ioBroker.plex#advanced-setup-plex-pass-or-tautulli)
2. [Channels & States](https://github.com/Zefau/ioBroker.plex#channels--states)
3. [Changelog](https://github.com/Zefau/ioBroker.plex#changelog)
4. [Licence](https://github.com/Zefau/ioBroker.plex#license)


## Setup instructions
### Basic Setup
For the basic setup it is only required to provide the IP address (and port) of your Plex installation. Once this is given, ioBroker.plex will retrieve all the basic data (incl. Servers, Libraries). See [Channels & States](https://github.com/Zefau/ioBroker.plex#with-basis-setup) for the full list of basic data.

### Advanced Setup (Plex Pass or Tautulli)
#### Plex Pass
If you are a Plex Pass user, you may [setup a webhook](https://support.plex.tv/articles/115002267687-webhooks/#toc-0) in the Plex Settings to retrieve the current event / action from your Plex Media Server (play, pause, resume, stop, viewed and rated).

Navigate to your Plex Media Server and go to ```Settings``` and ```Webhook```. Created a new webhook by clicking ```Add Webhook``` and enter your ioBroker IP adress with the custom port specified in the ioBroker.plex settings and trailing ```/plex``` path, e.g. ```http://192.168.178.29:41891/plex```:

![Plex Webhook](https://raw.githubusercontent.com/Zefau/ioBroker.plex/master/img/screenshot_plex-webhook.png)

#### Tautulli
[Tautulli is a 3rd party application](https://tautulli.com/#about) that you can run alongside your Plex Media Server to monitor activity and track various statistics. Most importantly, these statistics include what has been watched, who watched it, when and where they watched it, and how it was watched. All statistics are presented in a nice and clean interface with many tables and graphs, which makes it easy to brag about your server to everyone else. Check out [Tautulli Preview](https://tautulli.com/#preview) and [install it on your preferred system](https://github.com/Tautulli/Tautulli-Wiki/wiki/Installation) if you are interested.

This adapter connects to the [Tautulli API](https://github.com/Tautulli/Tautulli/blob/master/API.md) and also receives webhook events from Tautulli.

##### API
Once Tautulli is installed, open the _Settings_ page from Tautulli dashboard and navigate to _Web Interface_. Scroll down to the _API_ section and make sure ```Enable API``` is checked. Copy the ```API key``` and enter it in the ioBroker.plex settings. Furthermore, add the Tautulli IP address and port to allow API communication.

##### Webhook
Once installed open the settings page from Tautulli dashboard and navigate to Notification Agents as seen below:

![Tautulli Settings](/img/screenshot_tautulli-settings.png)

Click _Add a new notification agent_ and _Webhook_.
Enter your ioBroker IP adress with the custom port specified in the ioBroker.plex settings and trailing ```/tautulli``` path, e.g. ```http://192.168.178.29:41891/tautulli```:

![Tautulli Webhook](/img/screenshot_tautulli-webhook.png)

Furthermore, choose ```POST``` for the _Webhook Method_ and enter any description you like in _Description_.
Finally, go to the _Triggers_ tab, select your desired (or simply all) options and __most important__ fill in the respective data payload in the _Data_ tab according to the following table:

| Type of Notification | Example of JSON data |
| -------------------- | -------------------- |
| Playback Start | ```{"event":"media.play"}``` |
| Playback Stop | ```{"event":"media.stop"}``` |
| Playback Pause | ```{"event":"media.pause"}``` |
| Playback Resume | ```{"event":"media.resume"}``` |
| Transcode Decision Change | _to be defined_ |
| Watched | _to be defined_ |
| Buffer Warning | _to be defined_ |
| User Concurrent Streams | _to be defined_ |
| User New Device | _to be defined_ |
| Recently Added | _to be defined_ |
| Plex Server Down | _to be defined_ |
| Plex Server Back Up | _to be defined_ |
| Plex Remote Access Down | _to be defined_ |
| Plex Remote Access Back Up | _to be defined_ |
| Plex Update Available | _to be defined_ |
| Tautulli Update Available | _to be defined_ |

__Note:__ The JSON data is highly customizable and can be changed to any data you wish, see [the list of available parameters](https://github.com/Zefau/ioBroker.plex/blob/master/README-tautulli.md#list-of-available-parameters) for the full list of possibilities. __Please be aware__, that the notification types for ```Playback``` __require at least__ ```{"Player": {"title": "{player}", "uuid": "{machine_id}"} ``` as well as ```{"Metadata": {"key": ""}}``` in order to work correctly.


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

### 0.2.0 (2019-04-xx) [PLANNED RELEASE]
- add playback control for players
- add support for all Tautulli triggers
- add state description for object tree ```_playing```

### 0.1.0 (2019-04-xx) [IN DEVELOPMENT]
- get initial data from Plex API
- receive events from Plex Webhook (Plex Pass only)
- receive events from Tatulli (if used)


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
