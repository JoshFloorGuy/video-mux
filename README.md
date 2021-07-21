# Set Up

## Required Libraries and Building

For the Node portion of this project, you will need the following libraries

* `node-media-server`
* `express`
* `ws`

You will also need `ffmpeg` installed on your machine.

To build the c++ portion of this application you will need 2 libraries:

* [GStreamer](https://gstreamer.freedesktop.org/download/)
* [Boost](https://www.boost.org/users/history/version_1_76_0.html) (I used Boost v1.76)

The CMake file can be found in the `gstreamer` folder, and build in the `BUILDS` folder, which is blocked by gitignore. Once you've done that, you should have a program file called `gstream_switch`

## Running this Project

1. Run the c++ program. By default, it looks for incoming RTMP streams on `localhost`, this can be changed by passing in the target IP/Host on startup. Ex: `gstream_switch 192.168.1.22`
2. Run `backend.js`. By default, it listens to `host` in `config.json` but this can be changed by passing in the target IP/Host on startup. Ex: `node backend 192.168.1.22`
3. Sources can now connect to the RTMP server at `rtmp://{host}/live`, using a stream key of choice, or stream to `rtmp://{host}/live/{key}`. For example, when testing this project, I would use Open Broadcaster Software (OBS), and stream to the given host with a stream key 'a' on my main computer, and stream key 'b' on my other computer.
4. The output of the selected stream can be viewed at `rtmp://{host}/final/live`
5. A simple control panel for the switch can be found by going to `http://{host}/home.html`. Currently, it can
	* Display what streams are currently connected
	* Switch streams (if they are ready)
6. `node-media-server` provides a dashboard that can monitor all streams handled by the server. This can be accessed at `http://{host}:8000/admin`

## Accessing Web Pages

Because I could not find a proper solution to creating a private key and signature on a local network, in order to access web pages on another browser, you will need to tunnel requests to your machine through an outside service like [ngrok](https://ngrok.com/). This will also be the case if you want to accept incoming streams from devices outside your network. In the future, if this is deployed as a service, it will have a dedicated domain with a private key and signature, which will be passed in through the application.
