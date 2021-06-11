#pragma once
#include <string>
#include <gst/gst.h>
#define MEDIASERVER_SIZE 32

using std::string;

class MediaServer;

// Entry for media server hash table
class Entry {
public:
	Entry(int i, string k, void* d);
	void* data;
	string key;
	int index;
};

class MediaTable {
	int size;
	int maxSize = MEDIASERVER_SIZE;
	Entry *table[MEDIASERVER_SIZE];
	int hashCode(string key);
public:
	MediaTable();
	bool isFull();
	bool insertItem(string key, void* data);
	Entry* search(string key);
	void* MediaTable::get(string key);
	bool contains(string key);
	bool deleteItem(string key);
};

class MediaConnection {
	GstElement* source, * demux, * decode, * vidSwitch;
	GstPad* connectionPad = NULL;
	uint8_t state;
	MediaServer *server;
	/*
	* The element's state is comprised of 4 bits, 0 is least significant bit
	* Bit 0: demux is connected
	* Bit 1: decode is connected
	* Bit 2: MediaConnection is ready
	* Bit 3: Element is the currently playing item
	*/
public:
	MediaConnection(GstElement* s, GstElement* dm, GstElement* dc, GstElement* sw, MediaServer *sv);
	bool connectElement(GstElement* elem);
	bool removeFromPipeline(GstElement* pipeline);
	GstPad* getPad();
	bool isActive();
	bool isReady();
	void setActive(bool active);
};

class MediaServer {
	GstElement* pipeline, * switchPad;
	GstElementFactory* queueFactory;
	MediaTable table;
	GMainLoop* main_loop;
	string endpoint;
	string makeEndpointURI(string app, string name);
	MediaConnection* active = NULL;
public:
	MediaServer(string outputAddress);
	bool addConnection(string incomingName);
	bool switchConnection(string incomingName);
	bool closeConnection(string incomingName);
	void setActiveConnection(MediaConnection *newActive);
	void start();
};