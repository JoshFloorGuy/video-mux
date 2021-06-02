#pragma once
#include <string>
#include "mediaServer.h"

void threadListener(int port, bool *endListener, MediaServer* server);