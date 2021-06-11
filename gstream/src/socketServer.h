#pragma once
#include <string>
#include "mediaServer.h"
#include <boost/asio.hpp>

void threadListener(int port, bool *endListener, MediaServer* server);