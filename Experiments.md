# Experimentation Results

## FFmpeg experiment results

Thumbnail Preview: 

`ffmpeg -re -i rtmp://localhost/live/{name} -r 0.5 -c:v libx264 -preset veryfast -tune zerolatency -vf scale=-1:360 -an -f flv rtmp://localhost/thumbnails/{name}`

Resized Stream:

`ffmpeg -re -i rtmp://localhost/live/{name} -c:v libx264 -preset veryfast -tune zerolatency -vf scale=-1:720 -c:a aac -ar 44100 -f flv rtmp://localhost/rendered/{name}`

## GStreamer Result

`gst-launch-1.0 -v rtmpsrc location=rtmp://localhost/live{name} name={name}Src ! flvdemux ! decodebin ! input-selector name=switch ! queue ! videoscale add-borders=false ! videorate ! capsfilter video/x-raw, profile=baseline, width=1280, height=720, framerate=30/1 ! x264enc ! queue ! flvmux ! queue ! rtmpsink location=rtmp://localhost/final/{muxName}`
