#include <iostream>
#include <gst/gst.h>
#include <thread>
#include "socketServer.h"
#include "mediaServer.h"


int main(int argc, char* argv[]) {
    gst_init(&argc, &argv);

    string host = "localhost";
    if (argc == 2) {
        host = argv[1];
    }

    std::cout << "Looking for streams on host " << host << std::endl;

    string rtmpURL = "rtmp://" + host + "/";

    // Create parameters to pass to thread
    bool end = false;
    MediaServer table(rtmpURL);

    std::thread socketListener(threadListener, 6000, &end, &table);

    table.start();
    end = true;
    socketListener.join();

    return 0;
}