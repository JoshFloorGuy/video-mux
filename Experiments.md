# Experimentation Results

Throughout the research and planning phases of this project, FFmpeg was going to be the choice for the server. However, after further research

## FFmpeg experiment results

Thumbnail Preview: 

`ffmpeg -re -i rtmp://localhost/live/{name} -r 0.5 -c:v libx264 -preset veryfast -tune zerolatency -vf scale=-1:360 -an -f flv rtmp://localhost/thumbnails/{name}`

Resized Stream:

`ffmpeg -re -i rtmp://localhost/live/{name} -c:v libx264 -preset veryfast -tune zerolatency -vf scale=-1:720 -c:a aac -ar 44100 -f flv rtmp://localhost/rendered/{name}`

### Endpoint Names

This RTMP server has the following naming convention for streams:

`rtmp://localhost/{APP}/{NAME}`

Where APP and NAME use uri safe characters. Ideally, to determine a user's credentials, APP would be the name of the multiplexer, and NAME would be the user's stream key, which would most likely be a hash of the mux name, the user's username, and another key. The thumbnails APP would be used for the rendered thumbnail streams, and the rendered APP would be used for 720p 30fps versions of these incoming streams (this would later be removed)

## GStreamer Result

`gst-launch-1.0 -v rtmpsrc location=rtmp://localhost/live{name} name={name}Src ! flvdemux ! decodebin ! input-selector name=switch ! queue ! videoscale add-borders=false ! videorate ! capsfilter video/x-raw, profile=baseline, width=1280, height=720, framerate=30/1 ! x264enc ! queue ! flvmux ! queue ! rtmpsink location=rtmp://localhost/final/{muxName}`

## GStreamer FFmpeg comparison

The GStreamer result aims to replicate the FFmpeg Resized stream. The similar elements are as follows:

- `rtmpsrc` = `-re -i`, request stream
- `videorate` = `-re`, framerate
- `videoscale` = `-vf scale`, video scale
- `rtmpsink` = `-f flv`, sends stream to server
- `x264enc` = `-c:v libx264`, encodes to x264 codec

The GStreamer pipeline differs a few ways. First, the rate and scale are not defined within the element definitions, they are defined after the fact. This is just how GStreamer handles filters, with a capsfilter element. The second thing that's different is the decoder before everything. In order to go through GStreamer filters and the input-selector, the stream must be raw video. And finally, the video needs to be demuxed and remuxed for flv in the GStreamer pipeline, because for raw streams, there is a video tarack and at least one audio track, while RTMP takes one FLV stream
