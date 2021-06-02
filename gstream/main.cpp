#include <iostream>
#include <gst/gst.h>
#include <thread>
#include "socketServer.h"
#include "mediaServer.h"

#define TEST false

class StreamData {
public:
    GstElement* pipeline;
    GMainLoop* loop;
};

static void new_pad(GstElement* e, GstPad* p, gpointer d) {
    printf("pee\n");
}

static void cb_message(GstBus* bus, GstMessage* msg, StreamData* data) {

    switch (GST_MESSAGE_TYPE(msg)) {
    case GST_MESSAGE_ERROR: {
        GError* err;
        gchar* debug;

        gst_message_parse_error(msg, &err, &debug);
        g_print("Error: %s\n", err->message);
        g_error_free(err);
        g_free(debug);

        gst_element_set_state(data->pipeline, GST_STATE_READY);
        g_main_loop_quit(data->loop);
        break;
    }
    case GST_MESSAGE_EOS:
        /* end-of-stream */
        gst_element_set_state(data->pipeline, GST_STATE_READY);
        g_main_loop_quit(data->loop);
        break;
    case GST_MESSAGE_CLOCK_LOST:
        /* Get a new clock */
        gst_element_set_state(data->pipeline, GST_STATE_PAUSED);
        gst_element_set_state(data->pipeline, GST_STATE_PLAYING);
        break;
    default:
        /* Unhandled message */
        break;
    }
}

int main(int argc, char* argv[]) {
    gst_init(&argc, &argv);

#if TEST

    GstElement* pipeline = nullptr;
    GstBus* bus = nullptr;
    GstMessage* msg = nullptr;
    GstStateChangeReturn ret;
    gboolean terminate = FALSE;
    GstElement* source, *sink;
    GstElement *queue2, * mux, * demux, *q1, *q2, *q3;
    GstElementFactory* queue;
    GMainLoop* main_loop;

    StreamData data;
    // gstreamer initialization
    source = gst_element_factory_make("rtmp2src","source");
    sink = gst_element_factory_make("rtmp2sink","sink");
    mux = gst_element_factory_make("flvmux","mux");
    demux = gst_element_factory_make("flvdemux","demux");
    queue2 = gst_element_factory_make("queue2", NULL);

    queue = gst_element_factory_find("queue");
    q1 = gst_element_factory_create(queue, NULL);
    q2 = gst_element_factory_create(queue, NULL);
    q3 = gst_element_factory_create(queue, NULL);
    //queue = gst_element_factory_get("queue");
    //queue2 = gst_element

    pipeline = gst_pipeline_new("test-pipeline");

    bus = gst_element_get_bus(pipeline);

    memset(&data, 0, sizeof(data));

    gst_bin_add_many(GST_BIN(pipeline), source, sink, mux, demux, queue2, q1, q2, q3, NULL);
    gst_element_link_many(source, queue2, NULL);
    gst_element_link_pads(queue2, "src", demux, "sink");
    g_signal_connect(demux, "pad-added", G_CALLBACK(new_pad), NULL);
    /*
    if (!gst_element_link_many(source, sink, NULL)) {
        g_printerr("Things didn't work out");
        gst_object_unref(pipeline);
        return -1;
    }*/
    g_object_set(source, "location", "rtmp://localhost/live/a", NULL);
    g_object_set(sink, "location", "rtmp://192.168.1.19/live/b", NULL);

    ret = gst_element_set_state(pipeline, GST_STATE_PLAYING);
    if (ret == GST_STATE_CHANGE_FAILURE) {
        g_printerr("Unable to set the pipeline to the playing state.\n");
        gst_object_unref(pipeline);
        return -1;
    }

    main_loop = g_main_loop_new(NULL, FALSE);

    data.loop = main_loop;
    data.pipeline = pipeline;

    gst_bus_add_signal_watch(bus);
    g_signal_connect(bus, "message", G_CALLBACK(cb_message), &data);

    g_main_loop_run(main_loop);

    /* Free resources */

    gst_object_unref(bus);
    gst_element_set_state(pipeline, GST_STATE_NULL);
    gst_object_unref(pipeline);



#else
    // Create parameters to pass to thread
    bool end = false;
    MediaServer table("rtmp://192.168.1.19/");

    std::thread socketListener(threadListener, 6000, &end, &table);

    table.start();
    end = true;
    socketListener.join();
#endif
    return 0;
}