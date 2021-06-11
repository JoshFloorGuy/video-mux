#include "mediaServer.h"
#include <iostream>

#define MAXKEYLEN 32

void removeElement(GstBus* bus, GstMessage* msg, MediaConnection* data) {

}

// Hashes key
int MediaTable::hashCode(string key) {

	// Substring incoming key to max key length
	int len = (MAXKEYLEN < key.length()) ? MAXKEYLEN : key.length();
	string newKey = key.substr(0, len);

	// Multiplies each character by a reverse factorial (I think that's what it is)
	int value = 0;
	long long power = 1;
	int index = len;
	const int m = 1e9 + 9;
	for (char c : newKey) {
		value = (value + c * power) % m;
		index--;
		power = (power * index) % m;
	}
	return value % maxSize;
}

bool MediaTable::isFull() {
	return (this->maxSize == this->size);
}

bool MediaTable::insertItem(string key, void* data) {
	if (this->isFull()) return false;
	int index = hashCode(key);
	int end = index;
	do {
		if (table[index] == NULL) {
			table[index] = (Entry *) malloc(sizeof(Entry));
			if (table[index] == NULL) return false;
			memcpy(table[index], new Entry(index, key, data), sizeof(Entry));
			size++;
			return true;
		}
		if (table[index]->key == key) return false;
		index++;
		index % maxSize;
	} while (end != index);
	return false;
}

void* MediaTable::get(string key) {
	Entry* ret = search(key);
	if (ret == NULL) return ret;
	return ret->data;
}

Entry* MediaTable::search(string key) {
	int index = hashCode(key);
	int end = index;
	do {
		if (table[index] == NULL) return NULL;
		if (table[index]->key == key) return table[index];
		index++;
		index % maxSize;
	} while (end != index);
	return NULL;
}

bool MediaTable::contains(string key) {
	return !(this->search(key) == NULL);
}

// Private helper function

// Delete an item from the table
bool MediaTable::deleteItem(string key) {
	Entry* item = search(key);
	if (item == NULL) return false;
	free(table[item->index]);
	return true;
}

MediaTable::MediaTable() {
	size = 0;
	for (int i = 0; i < maxSize; i++) {
		table[i] = NULL;
	}
}

Entry::Entry(int i, string k, void* d) {
	index = i;
	key = k;
	data = d;
}

/*
* MediaConnection
* 
* This is an element representing an incoming media connection.
* source, demux, decode: the corresponing GstElements, connected in that order
* pipeline: the master pipeline for this application
* vidSwitch: the input-selector element of the master pipeline
* connectionPad: the pad that connects decode and input-selector
* state: the state of the element
* server: a reference to the parent mediaServer
*/

MediaConnection::MediaConnection(GstElement* s, GstElement* dm, GstElement* dc, GstElement* sw, MediaServer* sv)
{
	source = s;
	demux = dm;
	decode = dc;
	vidSwitch = sw;
	server = sv;
	state = 0x0;
}

bool MediaConnection::connectElement(GstElement* elem) {
	GstElement* prev, * next;
	prev = elem;
	if (elem == demux) {
		if (state & 0b1) return false;
		next = decode;
	} else {
		if (state & 0b10) return false;
		next = vidSwitch;
	}
	if (gst_element_link(prev, next)) {
		if (prev == demux) {
			state |= 0b01;
		}
		else {
			state |= 0b10;
		}
		if ((state & 0b11) == 0b11) {
			connectionPad = gst_element_get_static_pad(decode, "src_0")->peer;
			state |= 0b100;
			if (vidSwitch->numsinkpads == 1) {
				server->setActiveConnection(this);
			}
		}
		return true;
	}
	return false;
}

bool MediaConnection::removeFromPipeline(GstElement* pipeline) {
	try {
		gst_bin_remove_many(GST_BIN(pipeline),source, demux, decode, NULL);
		gst_object_unref(source);
		gst_object_unref(demux);
		gst_object_unref(decode);
		return true;
	}
	catch (int e) {
		std::cout << "Error code " << e << std::endl;
		return false;
	}
}

GstPad* MediaConnection::getPad() {
	return connectionPad;
}
bool MediaConnection::isActive() {
	return state & 0x8;
}
bool MediaConnection::isReady() {
	return state & 0x4;
}
void MediaConnection::setActive(bool active) {
	if (active) {
		state |= 0x8;
	}
	else {
		state &= 0x7;
	}
}

string MediaServer::makeEndpointURI(string app, string name) {
	string ret = endpoint.c_str();
	return ret.append(app).append("/").append(name);
}

struct connectionAndSwitch {
	MediaConnection* connection;
	GstElement* selector;
};

static void finishConnection(GstElement* elem, GstPad* pad, MediaConnection *connection) {
	connection->connectElement(elem);// gst_element_link(current, next);
	//gst_element_link_pads(mux, "src", e->sink, "sink");
}

MediaServer::MediaServer(string outputAddress) {
	bool failed = false;
	endpoint = outputAddress;
	GstElement* mux, * sink, * scale, *framerate, * scalefilter, * convertfilter, * postConvert;
	// queues
	GstElement* q1, * q2, * q3;
	GstCaps* scaleCaps;
	pipeline = gst_pipeline_new("bigPipeline");

	// A lot of queues are used, this may save time
	queueFactory = gst_element_factory_find("queue");

	switchPad = gst_element_factory_make("input-selector", "bigselector");
	scale = gst_element_factory_make("videoscale", "finalscale");
	framerate = gst_element_factory_make("videorate", "finalrate");
	scaleCaps = gst_caps_from_string("video/x-raw, profile=baseline, width=1280, height=720, framerate=30/1");
	scalefilter = gst_element_factory_make("capsfilter", NULL);
	g_assert(scalefilter != NULL);
	postConvert = gst_element_factory_make("x264enc", NULL);
	mux = gst_element_factory_make("flvmux", "finalmux");
	sink = gst_element_factory_make("rtmpsink", "endpoint");
	q1 = gst_element_factory_create(queueFactory, NULL);
	q2 = gst_element_factory_create(queueFactory, NULL);
	q3 = gst_element_factory_create(queueFactory, NULL);

	//input - selector name = input
	//videoscale
	//videorate
	//video / x - raw, profile = baseline
	//x264enc
	//flvmux
	//rtmp2sink location = rtmp://localhost/final/live

	gst_bin_add_many(GST_BIN(pipeline), switchPad, scale, framerate, scalefilter, postConvert, mux, sink, q1, q2, q3, NULL);
	if (!gst_element_link_many(switchPad, q1, scale, framerate, scalefilter, postConvert, q2, mux, q3, sink, NULL)) {
		failed = true;
		g_printerr("Error: failed to link elements\n");
	}

	g_object_set(scale, "add-borders", false, NULL);
	g_object_set(sink,"location",makeEndpointURI("final","live").c_str(), NULL);
	g_object_set(scalefilter, "caps", scaleCaps, NULL);

	if (gst_element_set_state(pipeline, GST_STATE_PLAYING) == GST_STATE_CHANGE_FAILURE) {
		g_printerr("Error: failure to start pipeline\n");
		failed = true;
	}

	main_loop = NULL;
	if(!failed) main_loop = g_main_loop_new(NULL, FALSE);
}

bool MediaServer::addConnection(string incomingName) {
	if (table.contains(incomingName)) return false;
	GstElement* source, *demux, *decode, *superQueue;

	//rtmp2src location = rtmp://localhost/live/a do-timestamp=true
	//flvdemux
	//decodebin
	//queue
	string enpoint = makeEndpointURI("live", incomingName);
	string srcName = ((string) "src-") + (incomingName);
	string demuxName = ((string) "demux-") + (incomingName);
	string decodeName = ((string) "decode-") + (incomingName);

	source = gst_element_factory_make("rtmpsrc", srcName.c_str());
	demux = gst_element_factory_make("flvdemux", demuxName.c_str());
	decode = gst_element_factory_make("decodebin", decodeName.c_str());
	//superQueue = gst_element_factory_make("queue2", NULL);

	MediaConnection * connectionPointer;
	connectionPointer = (MediaConnection*) malloc(sizeof(MediaConnection));
	if (connectionPointer == 0) return false;
	memcpy(connectionPointer, (new MediaConnection(source,demux,decode,switchPad,this)), sizeof(MediaConnection));

	// Add new connection to the table
	if (!table.insertItem(incomingName, (void*) connectionPointer)) {
		gst_object_unref(source);
		gst_object_unref(demux);
		gst_object_unref(decode);
		free(connectionPointer);
		return false;
	}

	g_object_set(source, "location", enpoint.c_str(), NULL);
	g_object_set(source, "do-timestamp", true, NULL);

	// Add elements to the pipeline bin and link source to demux
	gst_bin_add_many(GST_BIN(pipeline), source, demux, decode, NULL);
	gst_element_link_many(source, demux, NULL);
	// Add signal listener for demux and decode pads
	g_signal_connect(demux, "pad-added", G_CALLBACK(finishConnection), connectionPointer);
	g_signal_connect(decode, "pad-added", G_CALLBACK(finishConnection), connectionPointer);
	bool ret = true;
	// Set each new element to playing
	if (gst_element_set_state(decode, GST_STATE_PLAYING) == GST_STATE_CHANGE_FAILURE) {
		g_printerr("Decode could not start\n");
		ret = false;
	}
	if (gst_element_set_state(demux, GST_STATE_PLAYING) == GST_STATE_CHANGE_FAILURE) {
		g_printerr("Demux could not start\n");
		ret = false;
	}
	if (gst_element_set_state(source, GST_STATE_PLAYING) == GST_STATE_CHANGE_FAILURE) {
		g_printerr("Source could not start\n");
		ret = false;
	}
	if (!ret) {
		gst_object_unref(source);
		gst_object_unref(demux);
		gst_object_unref(decode);
		table.deleteItem(incomingName);
	}
	return ret;
}

void MediaServer::setActiveConnection(MediaConnection *newActive) {
	if (active != NULL) active->setActive(false);
	active = newActive;
	newActive->setActive(true);
}

bool MediaServer::switchConnection(string key) {
	MediaConnection* newSource = (MediaConnection*)table.get(key);
	if (newSource == NULL) {
		std::cout << "Error: '" << key << "' does not exist" << std::endl;
		return false;
	}
	if (newSource->isActive()) {
		std::cout << "Error: '" << key << "' is already active" << std::endl;
		return false;
	}
	if (!newSource->isReady()) {
		std::cout << "Error: '" << key << "' is not ready" << std::endl;
		return false;
	}
	try {
		gst_element_set_state(switchPad, GST_STATE_PAUSED);
		g_object_set(G_OBJECT(switchPad), "active-pad", newSource->getPad(), NULL);
		setActiveConnection(newSource);
		gst_element_set_state(switchPad, GST_STATE_PLAYING);
		return true;
	}
	catch (int e) {
		std::cout << "Error code " << e << std::endl;
		return false;
	}
}

bool MediaServer::closeConnection(string key) {
	MediaConnection* newSource = (MediaConnection*)table.get(key);
	if (newSource == NULL) {
		std::cout << "Error: Stream '" << key << "' does not exist" << std::endl;
		return false;
	}
	if (!newSource->removeFromPipeline(pipeline)) {
		std::cout << "There was a problem deleting " << key << std::endl;
		return false;
	}
	return table.deleteItem(key);
}

void MediaServer::start() {
	if(main_loop != NULL) g_main_loop_run(main_loop);
}