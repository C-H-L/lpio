/*
	TODO: pin interrupt using epoll and events.EventEmitter
	reference:
		https://github.com/EnotionZ/gpio/blob/master/lib/gpio.js
		https://github.com/JamesBarwell/rpi-gpio.js/blob/master/rpi-gpio.js
		https://github.com/fivdi/onoff/blob/master/onoff.js
		
		https://github.com/fivdi/epoll
		https://www.tutorialspoint.com/nodejs/nodejs_event_emitter.htm
		https://www.kernel.org/doc/Documentation/gpio/sysfs.txt
*/

import os from "os";
import fs from "fs";
import events from "events";
import epoll from "epoll";

let osCheckWarned = false;
function osCheck()
{
	if(os.platform() !== "linux")
	{
		if(!osCheckWarned)
		{
			console.error("lpio only works on linux OS");
			osCheckWarned = true;
		}
		return false;
	}
	osCheckWarned = false;
	return true;
}

const Direction = Object.freeze({ In: "in", Out: "out", });
const Value = Object.freeze({ Low: "0", High: "1", });
const Edge = Object.freeze({
	None: "none",
	Rising: "rising",
	Falling: "falling",
	Both: "both"
});

const GPIOS_PATH = "/sys/class/gpio";
const GPIO_PATH = (p) => `/sys/class/gpio/gpio${p}`;
const GPIO_DIRECTION = (p) => `/sys/class/gpio/gpio${p}/direction`;
const GPIO_VALUE = (p) => `/sys/class/gpio/gpio${p}/value`;
const GPIO_EDGE = (p) => `/sys/class/gpio/gpio${p}/edge`;
const GPIO_ACTIVE_LOW = (p) => `/sys/class/gpio/gpio${p}/active_low`;

const emitter = new events.EventEmitter();

const fsExists = async (path) => {
	try
	{
		await fs.promises.access(path);
		return true;
	}
	catch(e)
	{
		return false;
	}
};
const isGPIOExported = async (p) => await fsExists(GPIO_PATH(p));

const core = {
	unexport: async (pin) =>
	{
		await fs.promises.writeFile(`${GPIOS_PATH}/unexport`, pin + "");
	},
	export: async (pin) =>
	{
		await fs.promises.writeFile(`${GPIOS_PATH}/export`, pin + "");
	},
	setDirection: async (pin, dir) =>
	{
		await fs.promises.writeFile(GPIO_DIRECTION(pin) + "", dir + "");
	},
	write: async (pin, val) =>
	{
		await fs.promises.writeFile(GPIO_VALUE(pin) + "", val + "");
	},
	read: async (pin) =>
		(await fs.promises.readFile(GPIO_VALUE(pin) + "")).toString("utf8", 0, 1) === "0" ? Value.Low : Value.High,
	setEdge: async (pin, edge) =>
	{
		if(!await fsExists(GPIO_EDGE(pin))) return false;
		await fs.promises.writeFile(GPIO_EDGE(pin) + "", edge + "");
		return true;
	},
	setActiveLow: async (pin, val) =>
	{
		await fs.promises.writeFile(GPIO_ACTIVE_LOW(pin) + "", val ? "1" : "0");
	},
};

async function initInterruptForPin(pin)
{
	if(await core.setEdge(pin, Edge.Both))
	{
	
	}
}

async function deInitInterruptForPin(pin)
{
	for(let i in Edge)
		emitter.removeAllListeners(`gpio${pin}${i}`);
	
}

const lpio = {
	Direction: Direction,
	Value: Value,
	Edge: Edge,
	export: async (pin) =>
	{
		try
		{
			if(!osCheck()) return;
			if(await isGPIOExported(pin)) await core.unexport(pin);
			await core.export(pin);
			await initInterruptForPin(pin);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	unexport: async (pin) =>
	{
		try
		{
			if(!osCheck()) return;
			if(!await isGPIOExported(pin)) console.error(`Can't unexport pin ${pin} direction: Pin not exported`);
			await core.unexport(pin);
			await dInitInterruptForPin(pin);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	setDirection: async (pin, dir) =>
	{
		try
		{
			if(!osCheck()) return;
			if(!await isGPIOExported(pin)) console.error(`Can't set pin ${pin} direction: Pin not exported`);
			await core.setDirection(pin, dir);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	setActiveLow: async (pin, val) =>
	{
		try
		{
			if(!osCheck()) return;
			if(!await isGPIOExported(pin)) console.error(`Can't set pin ${pin} active low: Pin not exported`);
			await core.setActiveLow(pin, val);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	setupPin: async (pin, dir, activeLow = false) => // unexport + export + setDirection + setActiveLow
	{
		try
		{
			if(!osCheck()) return;
			
			if(await isGPIOExported(pin))
			{
				await core.unexport(pin);
				await deInitInterruptForPin(pin);
			}
			
			await core.export(pin);
			await initInterruptForPin(pin);
			
			await core.setDirection(pin, dir);
			
			await core.setActiveLow(pin, activeLow);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	write: async (pin, val) =>
	{
		try
		{
			if(!osCheck()) return;
			if(!await isGPIOExported(pin)) console.error(`Can't write to pin ${pin}: Pin not exported`);
			await core.write(pin, val);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	read: async (pin) =>
	{
		try
		{
			if(!osCheck()) return;
			if(!await isGPIOExported(pin)) console.error(`Can't read pin ${pin}: Pin not exported`);
			return await core.read(pin);
		}
		catch(e)
		{
			console.error(e);
		}
	},
	addInterruptHandler: async (pin, trigger, callback) =>
	{
		if(await fsExists(GPIO_EDGE(pin)))
		{
			try
			{
				if(!osCheck()) return;
				if(!await isGPIOExported(pin)) console.error(`Can't add interrupt to pin ${pin}: Pin not exported`);
				emitter.on(`gpio${pin}${trigger}`, callback);
			}
			catch(e)
			{
				console.error(e);
			}
		}
	},
	removeInterruptHandler: async (pin, trigger, callback) =>
	{
		if(await fsExists(GPIO_EDGE(pin)))
		{
			try
			{
				if(!osCheck()) return;
				if(!await isGPIOExported(pin)) console.error(
					`Can't remove interrupt from pin ${pin}: Pin not exported`);
				emitter.removeListener(`gpio${pin}${trigger}`, callback);
			}
			catch(e)
			{
				console.error(e);
			}
		}
	},
};

export default lpio;
