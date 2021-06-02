const net = require('net');

var a = process.argv[2];

const newSocket = net.createConnection(6000,"localhost", () => {
	
	newSocket.write(a);
	/*
	newSocket.on("data", (data) => {
		console.log(data);
	});
	console.log(newSocket.address()); */
})