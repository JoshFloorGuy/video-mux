const net = require('net');
const http = require('http');
// const util = require('./util.js');
const crypt = require('crypto');

var httpTest = http.createServer(
	function(req,res) {
		console.log(req);
	}
).listen(8081,"localhost");

var sockets = new Map();
var server = net.Server(function(socket) {
	//console.log(socket);
	socket.on("data", function(d) {
		console.log(d);
		if(sockets.get(socket)==null) {
			sockets.set(socket, newSocket(socket,d));
		} else {
			sockets.get(socket).response(d);
		}
		if(sockets.get(socket).state == -1) {
			socket.destroy();
		}
		//console.log(d);
	});
});


// This follows the RTMP protocol
function newSocket(s, d) {
	this.socket = s;
	this.version = d.readInt8(0);
	this.state = 0;
	this.clientCurrent = 0;
	this.firstShake = function(d,off) {
		this.timestart = Date.now();
		this.clientStart = d.readUInt32BE(off);
		this.clientCurrent = this.clientStart;
		if(d.readUInt32BE(off+4)!=0) {
			this.state = -1;
		} else {
			this.givenRandom = d.slice(8+off);
			crypt.randomBytes(1528, (err,r) => {
				if(err) {
					this.state = -1;
					console.log(err);
				} else {
					this.serverRandom = r;
					var temp = Buffer.alloc(9);
					// Writes version 3
					temp.writeIntBE(3,0,1);
					// Writes 4 empty bytes
					temp.writeUInt32BE(0,1);
					// Writes current timestamp (0)
					temp.writeUInt32BE(0,5);
					var s1 = Buffer.concat([temp,this.serverRandom],1537);
					this.socket.write(s1);
				}
			});
		}
	}
	this.secondShake = function(d) {
		if(d.readUInt32BE(0)!=0) {
			this.state = -1;
			return;
		}
		this.clientCurrent = d.readUInt32BE(0);
		console.log(Buffer.compare(d.slice(8),this.serverRandom));
		if(Buffer.compare(d.slice(8),this.serverRandom)!=0) {
			this.state = -1;
			return;
		}
		var temp = Buffer.alloc(8);
		temp.writeUInt32BE(this.clientStart,0);
		temp.writeUInt32BE(Date.now()-this.timestart,4);
		var s2 = Buffer.concat([temp,this.givenRandom],1536);
		this.socket.write(s2);
		console.log("finished 2");
		// TODO: Add Chunk Streaming
	}
	if(d.length==1) {
		this.state = 0;
		this.response = function(d) {
			this.firstShake(d,0);
		}
	} else if(d.length!=1537) {
		this.state = -1;
	} else {
		this.firstShake(d,1);
	}
	if(this.state > -1) {
		this.response = function(d) {
			this.secondShake(d);
		}
	}
	return this;
	//if(d.length
}

server.listen({host:"localhost",port:8080});