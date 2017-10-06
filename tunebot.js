// todo:
// multi discord server support
// relative octaves (nearest octave)
// percussion
// last note again '*'

var scribble = require('scribbletune');

const trigger = "~~";

const examples = {
	"Something": "normal: guitar: 2^c.c.3^c.2c.^c.c.3^c...1^a.a.2^a.1a.^a.a.2^a...1^f.f.2^f.1f.^f.f.2^f...1^g.g.2^g.1g.^g.g.2^g... :\n4^[c<g>]--[c<g>].[c<g>]de^[c<g>]--^[c<g>]....^[c<g>]--[c<g>].[c<g>]de^[fc<g>].[ec<g>].^[c<g>]...^[c<g>]--[c<g>].[c<g>]de^[c<g>]--^[c<g>]....^[c<g>]--[c<g>].[c<g>]de^[fc<g>].[ec<g>].^[c<g>].[d<g>].",
	"Nyan Cat": "fast: 2e.3e.2f#.3f#.2d#.3d#.2g#.3g#.2c#.3c#.2f#.3f#.1b>b<b.>c#.d#. 2e.3e.2f#.3f#.2d#.3d#.2g#.3g#.2c#.3c#.2f#.3f#.1b>b<b.>c#.d#. :\n5f#.g#.dd#.c#dc#<b.b.>c#.d.dc#<b>c#d#f#g#d#f#c#d#<b>c#<b>d#.f#.g#d#f#c#d#<b>dd#dc#<b>c#d.<b>c#d#f#c#dc#<b>c#.<b.b.",
	"Bad Apple": "fast: tuba: 2d#-->d#.d#c#d#< d#-->d#.d#c#d#< d#-->d#.d#c#d#< d#->d#f#<g#->f#g# 1b-->b.ba#b< 1b-->b.ba#b 2c#-->c#.c#<b>c# <d-->d.dcd  2d#-->d#.d#c#d#< d#-->d#.d#c#d#< d#-->d#.d#c#d#< d#->d#f#<g#->f#g# 1b-->b.ba#b< 1b-->b.ba#b 2c#-->c#.c#<b>c# <d-->d.dcd :\nhalf: trumpet: 4d#e#f#g#a#->d#c#<a#-d#-a#g#f#e# d#e#f#g#a#-g#f#e#d#e#f#e#d#de#  4d#e#f#g#a#->d#c#<a#-d#-a#g#f#e# d#e#f#g#a#-g#f#e#.f#.g#.a#. :\nquiet: trombone: 3a#>c#d#e#f#-a#g#f#-<a#->f#e#d#c# 3a#>c#d#e#f#-e#d#c#<a#>c#d#<a#a#g#g# f#g#a#>e#f#-a#g#f#-<a#->f#e#d#c# 3a#>c#d#e#f#-e#d#c#.d#.e#.e#.",
};

const programs = {
	"piano": 0,
	"harpsi": 6,
	"clav": 7,
	"xylo": 13,
	"organ": 19,
	"guitar": 24,
	"bass": 35,
	"violin": 40,
	"viola": 41,
	"cello": 42,
	"harp": 46,
	"trumpet": 56,
	"trombone": 57,
	"tuba": 58,
	"sax": 64,
	"oboe": 68,
	"clarinet": 71,
	"piccolo": 72,
	"flute": 73,
	"recorder": 74,
	"square": 80,
	"saw": 81,
	"pad": 89,
	"banjo": 105,
	"bell": 112,
}

const tempos = {
	"normal": 75,
	"fast": 100,
	"faster": 150,
	"fastest": 200,
	"slow": 50,
	"slower": 35,
	"slowest": 20,
}

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

function convert_midi_to_wav(program, tempo, volume, out)
{
	const { execSync } = require('child_process');
	let stdout = execSync('timidity out.mid -A '+volume+' --adjust-tempo=' + tempo + ' --force-program=' + program + ' -Ow -o ' + out); 
}

function merge_wavs(count)
{
	if(count == 0) return;
	const { execSync } = require('child_process');
	if(count == 1)
	{
		execSync('mv out_0.wav out.wav');
		return;
	}
	var files = "";
	for(var i = 0; i < count; i++)
	{
		files += " -i out_" + i + ".wav ";
	}
	let stdout = execSync('ffmpeg -y ' + files + ' -filter_complex amix=inputs='+count+' out.wav', {stdio:'ignore'});
}

function generate_wav(expression)
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
		if(p in programs)
		{
			program = programs[p];
		}
		else if(p === "loud")
		{
			volume = 100;
		}
		else if(p === "quiet")
		{
			volume = 50;
		}
		else if(p === "half")
		{
			tempo /= 2;
		}
		else if(p in tempos)
		{
			tempo = tempos[p];
		}
		else
		{
			generate_midi(p);
			convert_midi_to_wav(program, tempo, volume, "out_" + (i++) + ".wav");
		}
	}
	merge_wavs(i);
}

const Discord = require("discord.js");
const client = new Discord.Client();

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

function getVoiceConnection()
{
	// make this work with multiple servers... rn just assuming connected to a single server!
	return client.voiceConnections.first();
}

var playing = false;
var dispatcher = null;
function playSound(message)
{
	var voiceConnection = getVoiceConnection();
	if(!voiceConnection)
	{
		message.reply("You should invite me to a voice channel first! ^^ (Try this: `~~join`)");
	}
	else if(playing)
	{
		message.reply("Please wait until I'm finished playing the current tune~ (or stop it with `~~stop`)");
	}
	else
	{
		dispatcher = voiceConnection.playFile('out.wav');
		playing = true;

		dispatcher.on('end', () => {
			playing = false;
			dispatcher.end();
		});

		dispatcher.on('error', e => {
		  console.log(e);
		});
	}
}

client.on('message', message => {
	if(!message.guild) return;

	if(message.content.startsWith(trigger) && message.content.trim().length > 2)
	{
		var cmd = message.content.slice(2);
		if(message.member.voiceChannel)
		{
			if(cmd === "join" || cmd === "voice" || cmd === "enter" || cmd === "invite")
			{
				message.member.voiceChannel.join()
					.then(connection => {
						message.reply("I'm in there! ^^");
						})
					.catch(console.log);
			}
			else if(cmd === "stop" || cmd === "quit" || cmd === "quiet" || cmd === "end" || cmd === "shush" || cmd === "shh")
			{
				if(playing)
				{
					dispatcher.end();
				}
				else
				{
					message.reply("But I'm not playing anything right now! :o");
				}
			}
			else if(cmd === "leave" || cmd === "exit" || cmd === "part")
			{
				var voiceConnection = getVoiceConnection();
				if(!voiceConnection)
				{
					message.reply("I'm not in a voice channel though, silly. :3");
				}
				else
				{
					voiceConnection.disconnect();
					message.reply("Okay, I left... :c");
				}
			}
			else if(cmd === "again" || cmd === "repeat" || cmd === "encore")
			{
				playSound(message);
			}
			else if(cmd === "instruments" || cmd === "list" || cmd == "instrument")
			{
				var ls = [];
				for(var k of Object.keys(programs))
				{
					ls.push('`'+k+'`');
				}
				message.reply("These are the instruments that I know how to play: " + ls.join(", "));
			}
			else if(cmd === "examples" || cmd === "example" || cmd === "tunes" || cmd === "songs")
			{
				var ls = [];
				for(var k of Object.keys(examples))
				{
					ls.push('**'+k+':**```~~'+examples[k]+'```');
				}
				message.reply("Here's some examples of tunes you can have me play for you:\n\n" + ls.join('\n\n'));

			}
			else if(cmd === "help" || cmd === "commands" || cmd === "about" || cmd === "info")
			{
				message.reply(
"Hi! I'm **Tune Bot**!  I will play tunes for you that you can compose yourself and share with others! ^^\n\
\n\
**Here's some stuff I can do:** _(Commands)_\n\
• `~~join` — I'll join the voice channel you're in. :3\n\
• `~~leave` — I'll leave the voice channel if you'd really prefer, though I like being in there. :c\n\
• `~~stop` — I'll stop playing the tune I'm playing.\n\
• `~~encore` — If you really liked it, I'll play it for you again! :D\n\
• `~~help` — I'll tell you about myself and what I can do for you~ ^^\n\
• `~~tutorial` — I'll teach you how to make your very own tunes!\n\
• `~~instruments` — I'll show you the list of instruments I can play.\n\
• `~~examples` — I'll show you some examples of some tunes I can play for you. o:\n\
\n\
**How to play tunes!** _(Quick Start)_\n\
First, make sure I'm in a voice channel (if I'm not, you can invite be to one by going into one yourself and then telling me to `~~join` you.\n\
Once I'm in there, ask me to play _Bad Apple_ like this: ```~~defg a- >dc <a-d- agfe defg a-gf edef edc#e defg a- >dc <a-d- agfe defg a-gf e.f.g.a.```\n\
See my `~~examples` for some more examples of tunes I can play for you!\n\
If you're interested in composing your own tunes, ask me about my `~~tutorial`! :D"
				);
			}
			else if(cmd === "tutorial" || cmd === "composing" || cmd === "how" || cmd === "howto")
			{
				message.reply(
"**How to compose your own tunes!**\n\
_Basics:_\n\
After getting my attention by starting your message with `~~`, just tell me what notes you'd like to play! (`c d e f g a b`) I don't care about whitespace, so feel free to space out your musical typing however you like~  If you want to include a musical rest, use `.` and if you'd like to hold out a note a little longer, use `-`.  Just tell me a number if you want to tell me what octave to play the following notes in (`1 2 3 4 5 6 7`), or if you'd just like to move up or down an octave just put a `<` to go down or a `>` to go up. (It'll take affect for the following notes.) You can play chords by putting notes in `[]` like this simple C major triad chord here: `[c e g]`  And finally, if you'd like to really emphasize a note or a chord, just put `^` right before it, and I'll know to play it a little louder than all the rest. :3\n\
\n\
_Multiple Parts:_\n\
You can also tell me to play multiple parts at once by simply separating them with `:`!  You can even tell me what instrument to play by preceding a part with the instrument name + `:` like this example which plays two parts, one for trumpet and one for tuba: ```~~trumpet: 4efgc-- : tuba: 2cdgc--```\n\
Just let me know if you'd like to know which `~~instruments` I can play for you!\n\
Lastly, you can tell me to play different parts at different speeds by preceding a part with the speed + `:` like this example: ```~~fast: piano: c c# d d# e f f# g g# a a# b >^c ... <. c```\n\
These are the speeds I can do: `slowest slower slow normal fast faster fastest half` (`half` plays at half of whatever speed you already specified)\n\
If you don't tell me which speed to play at, I'll go at a `normal` speed, and if you don't tell me which instrument to play, I'll play the `piano` for you. :3\n\
_Happy Composing!~~_"
				);
			}
			else
			{
				var expression = cmd.trim();
				console.log("Expression: " + expression);
				try
				{
					generate_wav(expression);
					playSound(message);
				}
				catch(error)
				{
					console.log("\t-> Invalid musical expression!");
					message.reply("Mmm, I'm sorry, I couldn't figure that one out! ><");
				}
			}
		} else {
			message.reply('You should go into a voice channel first, silly! :3');
		}
	}
});

client.login('MzY1NjQ0Mjc2NDE3Mjk4NDMy.DLhfug.HCa5VE7jC_RsTeE0Jl3upm27OWk');
