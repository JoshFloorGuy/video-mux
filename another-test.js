const net = require('net');

const newSocket = net.createConnection(1935,"localhost", () => {
	newSocket.on("data", (data) => {
		console.log(data);
	});
	console.log(newSocket.address());
})