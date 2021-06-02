#include <thread>
#include "socketServer.h"
#include "mediaServer.h"
#include <chrono>
#include <iostream>
#include <boost/asio.hpp>
#include <vector>

//namespace kn = kissnet;
using std::string;
using std::vector;
using std::cout;
using std::endl;
namespace ba = boost::asio;
namespace bip = ba::ip;

// Found function for string hashing
constexpr unsigned int str2int(const char* str, int h = 0)
{
	return !str[h] ? 5381 : (str2int(str, h + 1) * 33) ^ str[h];
}

enum Commands {
	ADD_STREAM = str2int("add"),
	SWITCH_STREAM = str2int("switch"),
	CLOSE_STREAM = str2int("close"),
	CLOSE_SERVER = str2int("end")
};

void threadListener(int port, bool *endListener, MediaServer* server) {
	try
	{
		ba::io_service io;

		bip::tcp::acceptor acceptor(io, bip::tcp::endpoint(bip::tcp::v4(),port));


		while(!(*endListener))
		{
			bip::tcp::socket socket(io);
			acceptor.accept(socket);

			ba::streambuf b;
			ba::read_until(socket,b,"\0");
			string message = ba::buffer_cast<const char*>(b.data());

			vector<string> fullMessage;
			vector<string>::iterator i;
			int index = 0;
			while (message != "") {
				index = message.find(' ');
				if (index > -1) {
					fullMessage.push_back(message.substr(0,index));
					message = message.substr(index+1, message.length());
				}
				else {
					fullMessage.push_back(message);
					message = "";
				}
			}
			
			i = fullMessage.begin();

			switch (str2int((*i).c_str())) {
				case ADD_STREAM:
					i++;
					server->addConnection(*i);
					break;
				case SWITCH_STREAM:
					i++;
					server->switchConnection(*i);
					break;
				default:
					break;
			}

			/*
			while (i != std::end(fullMessage)) {
				cout << *i << " ";
				i++;
			}
			cout << endl;*/

			socket.close();

			/*
			std::string message = make_daytime_string();

			boost::system::error_code ignored_error;
			boost::asio::write(socket, boost::asio::buffer(message), ignored_error);*/
		}
	}
	catch (std::exception& e)
	{
		std::cerr << e.what() << std::endl;
	}
}
