// todo:
// loops
// auto leave voice channels when not in use
// delete messages after a bit in bot channel? maybe?
// arbitrary midi program numbers
// relative octaves (nearest octave)
// percussion
// last note again '*'
// edit messages, maybe?
// encores with arguments
// somehow fix playing unknown commands as music?
// add # and double to the tutorial
// ~~invite-link command
// private calls and dms
// looping structures
// inline tempo and patch changes
// slap bass, and just names for all the midis :p
// fix starting rests
// auto restart on error?
// read/play midi files?
// midi import and export via file sends
// inline musical snippits? :P
// tts singer
//
// join link:
// https://discordapp.com/oauth2/authorize?client_id=365644276417298432&scope=bot&permissions=0

// libraries
const scribble = require("scribbletune");
const Discord = require("discord.js");

// config
const config = require("./config");

// output a midi file from a musical expression
// translates from tunebot's language to scribbletune's language
// then uses scribbletune to output the midi file
function generate_midi(expression)
{
	var notes = [];
	var pattern = "";
	var accentMap = [];
	var octave = 4;
	var velocity = '70';

	var target = notes;

	for(var c of expression.toLowerCase())
	{
		if("abcdefg".indexOf(c) != -1)
		{
			target.push(c + octave);
			if(target == notes) pattern += 'x';
			if(target == notes) accentMap.push(velocity);
			velocity = '70';
		}
		else if(c == '#')
		{
			target[target.length - 1] += c;
		}
		else if(c == '[' && target == notes)
		{
			var newNest = [];
			target.push(newNest);
			target = newNest;
			pattern += 'x';
			accentMap.push(velocity);
			velocity = '70';
		}
		else if(c == ']')
		{
			target = notes;
		}
		else if(c == '-')
		{
			if(target == notes) pattern += '_';
		}
		else if(c == '.')
		{
			if(target == notes) pattern += '-';
		}
		else if(c == '^')
		{
			if(target == notes) velocity = '110';
		}
		else if(c == '>')
		{
			octave++;
		}
		else if(c == '<')
		{
			octave--;
		}
		else if("0123456789".indexOf(c) != -1)
		{
			octave = c;
		}
	}

	var clip = scribble.clip({
	    notes: notes,
	    pattern: pattern,
	    accentMap: accentMap,
	});  

	scribble.midi(clip, 'out.mid');
}

// MAKE THIS ASYNC!!

function convert_midi_to_wav(program, tempo, volume, out)
{
	const { execSync } = require('child_process');
	let stdout = execSync('timidity out.mid -A '+volume+' --adjust-tempo=' + tempo + ' --force-program=' + program + ' -Ow -o ' + out); 

/*
	const { spawn } = require("child_process");
        const child = spawn("chibi-scheme", ["-q", "-m", "lambot", "-p", expression]);
        
        child.stdout.on("data", (data) => {
                const str = data.toString().trim();
                callback(str);
        });
        
        child.stderr.on("data", (data) => {
                // gross code to supress redefine warnings
                var str = data.toString().trim();
                while(str.startsWith("WARNING: importing already defined binding: display") ||
                   str.startsWith("WARNING: importing already defined binding: import"))
                {       
                        if(str.indexOf("\n") == -1) return;
                        str = str.split("\n").slice(1).join("\n");
                }
                if(child.alreadyErrored) return;
                child.alreadyErrored = true;
                callback_error(str);
        });
        
        child.on("close", (code) => {
                // console.log(`child process exited with code ${code}`);
        });	*/
}

function merge_wavs(id, count)
{
	if(count == 0) return;
	const { execSync } = require('child_process');
	if(count == 1)
	{
		execSync('mv out_0_' + id + '.wav out_' + id + '.wav');
		return;
	}
	var files = "";
	for(var i = 0; i < count; i++)
	{
		files += " -i out_" + i + "_" + id + ".wav ";
	}
	let stdout = execSync('ffmpeg -y ' + files + ' -filter_complex amix=inputs='+count+' out_' + id + '.wav', {stdio:'ignore'});
}

// make a wave file from an expression
// id is the id of the discord server
// each discord server gets their own .wav output
function generate_wav(id, expression)
{
	var parts = expression.split(":");
	parts = parts.slice(0, 12); // some max args
	var program = 0;
	var tempo = 75;
	var volume = 100
	var i = 0;
	for(var p of parts)
	{
		p = p.trim().toLowerCase();
		if(p in config.programs)
		{
			program = config.programs[p];
		}
		else if(p === "loud")
		{
			volume = 100;
		}
		else if(p === "quiet")
		{
			volume = 50;
		}
		else if(p === "double")
		{
			tempo *= 2;
		}
		else if(p === "half")
		{
			tempo /= 2;
		}
		else if(p in config.tempos)
		{
			tempo = config.tempos[p];
		}
		else
		{
			generate_midi(p);
			convert_midi_to_wav(program, tempo, volume, "out_" + (i++) + "_" + id + ".wav");
		}
	}
	merge_wavs(id, i);
}


function getVoiceConnection(guild)
{
	for(var vc of client.voiceConnections)
	{
		if(guild.id === vc[1].channel.guild.id) return vc[1];
	}
}

var playingStatus = {};
var dispatchers = {};
function playSound(message)
{
	var voiceConnection = getVoiceConnection(message.guild);
	if(!voiceConnection)
	{
		sendBotString("onNotInVoiceChannel", (msg) => message.reply(msg));
	}
	else if(playingStatus[message.guild.id])
	{
		sendBotString("onAlreadyPlayingTune", (msg) => message.reply(msg));
	}
	else
	{
		dispatchers[message.guild.id] = voiceConnection.playFile('out_'+message.guild.id+'.wav');
		playingStatus[message.guild.id] = true;

		dispatchers[message.guild.id].on('end', () => {
			playingStatus[message.guild.id] = false;
			dispatchers[message.guild.id].end();
		});

		dispatchers[message.guild.id].on('error', e => {
		  console.log(e);
		});

		return true;
	}
	return false;
}

// send discord messages safely
// and properly split up messages longer than _limit_ characters
// callback is the send function for the first chunk
// tail is for the rest
function safeSend(msg, callback, callbackTail, chunkDelimiter="\n", charLimit=1800)
{
	if(!msg.trim().length) return;
	var first = msg;
	var rest = "";
	// make this safer so it aborts if something can't be split small enough
	while(first.length > charLimit)
	{
		if(first.indexOf(chunkDelimiter) == -1)
		{
			console.log("\t-> Can't split message into small enough pieces:");
			console.log(`{${first}}\n`);
			console.log("\t<-!!");
			return;
		}
		rest = first.split(chunkDelimiter).slice(-1).concat([rest]).join(chunkDelimiter);
		first = first.split(chunkDelimiter).slice(0, -1).join(chunkDelimiter);
	}
	callback(first);
	safeSend(rest, callbackTail, callbackTail, chunkDelimiter, charLimit);
}

// send a bot string from config file
// with optional stuff after it (arg)
function sendBotString(string, headSendFunction, tailSendFunction, arg="", chunkDelimiter, charLimit)
{
	const stringObj = config.botStrings[string];
	const msg = stringObj.string + arg;
	if(stringObj.enabled) safeSend(msg, headSendFunction, tailSendFunction, chunkDelimiter, charLimit);
}

// map of commands
const commands = {};

// add a command to the commands map
// names is all the aliases of the command
// f is the command function
function registerCommand(names, f)
{
	names.map((v) => {
		commands[v] = f;
	});
}

// the commands
// join a voice channel
registerCommand(["join", "voice", "enter", "invite"], (arg, args, message) => {
	if(message.member.voiceChannel)
	{
		message.member.voiceChannel.join().then(connection => {
			sendBotString("onJoinVoiceChannel", (msg) => message.reply(msg));
		}).catch(console.log);
	} else {
		sendBotString("onJoinVoiceChannelFail", (msg) => message.reply(msg));
	}
});

// stop playing a tune
registerCommand(["stop", "quit", "quiet", "end"], (arg, args, message) => {
	if(playingStatus[message.guild.id])
	{
		dispatchers[message.guild.id].end()
		sendBotString("onStopTune", (msg) => message.reply(msg));
	}
	else
	{
		sendBotString("onNotPlayingTune", (msg) => message.reply(msg));
	}
});

// leave a voice channel
registerCommand(["leave", "exit", "part"], (arg, args, message) => {
	const voiceConnection = getVoiceConnection(message.guild);
	if(!voiceConnection)
	{
		sendBotString("onLeaveVoiceChannelFail", (msg) => message.reply(msg));
	}
	else
	{
		voiceConnection.disconnect()
		sendBotString("onLeaveVoiceChannel", (msg) => message.reply(msg));
	}
});

// repeat the last tune
registerCommand(["again", "repeat", "encore"], (arg, args, message) => {
	if(playSound(message)) sendBotString("onEncore", (msg) => message.reply(msg));
});

// see what known instruments there are
registerCommand(["instruments", "list", "instrument"], (arg, args, message) => {
	// i'd prefer if this was more functionally written
	const ls = [];
	for(var i in Array(128).fill())
	{
		const aliases = [];
		for(var k of Object.keys(config.programs))
		{
			if(config.programs[k] == i) aliases.push(`\`${k}\``);
		}
		ls.push(`• \`p${parseInt(i) + 1}\`\t` + aliases.join(" "));
	}
	sendBotString("onInstrumentRequest", (msg) => message.channel.send(msg), (msg) => message.channel.send(msg), `\n${ls.join("\n")}`);
});

// see example tunes
registerCommand(["examples", "examples", "tunes", "songs"], (arg, args, message) => {
	var ls = [];
	for(var k of Object.keys(config.examples))
	{
		const name = k;
		const example = config.examples[k];
		if(example.credit)
		{
			ls.push('**'+name+':** _(sequenced by '+example.credit+')_```~~'+example.example+'```');
		}
		else
		{
			ls.push('**'+name+':** ```~~'+example.example+'```');
		}
	}
	sendBotString("onExampleRequest", (msg) => message.reply(msg), (msg) => message.channel.send(msg), `\n\n${ls.join("\n\n")}`, "\n\n");
});

// get general help
registerCommand(["help", "commands", "about", "info"], (arg, args, message) => {
	sendBotString("onHelpRequest", (msg) => message.reply(msg), (msg) => message.channel.send(msg));
});

// see the composing tutorial
registerCommand(["tutorial", "composing", "how", "howto"], (arg, args, message) => {
	sendBotString("onTutorialRequest", (msg) => message.reply(msg), (msg) => message.channel.send(msg));
});

// evaluate and play a musical expression
registerCommand(["play", "tune"], (arg, args, message) => {
	try
	{
		generate_wav(message.guild.id, arg);
		playSound(message);
	}
	catch(error)
	{
		console.log(`\t-> Invalid musical expression!\n${error}`);
		sendBotString("onTuneError", (msg) => message.reply(msg));
	}
});

// process a message to the bot
// the message string, and the originating discord message object
function processBotMessage(msg, message)
{
	// cmd is case insensitive, args retain case
	const words = msg.split(" ");
	const cmd = words[0].toLowerCase();
	const arg = words.slice(1).join(" ");
	const args = words.slice(1).filter((v) => {
		return v.length;
	});

	// get the command function and call it
	// assume play function if none other found
	const command = commands[cmd];
	if(command) command(arg, args, message);
	else commands.play(msg, words, message);
}

// make the discord connection
const client = new Discord.Client();

// once its all connected and good to go
client.on("ready", () => {
	console.log(`Logged in as ${client.user.tag}!`);
	client.user.setGame(`${config.trigger}help`);
});

// on message recieve
client.on("message", message => {
	if(client.user.id === message.author.id) return;
        const content = message.content.trim();
        const dm = !message.guild;
        const triggered = content.startsWith(config.trigger);
	const msg = triggered ? content.slice(config.trigger.length) : content;
	if(triggered && msg.length)
	{
		// received message directed at the bot
		console.log(`${message.guild.name}> #${message.channel.name}> ${message.author.username}> ${msg}`);
		processBotMessage(msg, message);
	}
});

// load the token from file and login
function main()
{
	const fs = require("fs");
	const token = fs.readFileSync("token.txt", "ascii").trim();
	client.login(token);
}

// run the bot!
main();
