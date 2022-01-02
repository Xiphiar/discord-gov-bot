import "reflect-metadata";
import { Intents, Interaction, Message, MessageEmbed } from "discord.js";
import { Client } from "discordx";
import { dirname, importx } from "@discordx/importer";
import * as dotenv from 'dotenv';
// @ts-ignore
import storage from 'node-persist';
import { CosmWasmClient } from 'secretjs';
import Axios from 'axios';
import fs from 'fs';
import * as cron from 'cron';
import fetch from "node-fetch";
dotenv.config();

// @ts-ignore
const queryJs = new CosmWasmClient(process.env.REST_URL);
var CronJob = cron.CronJob;

async function getProps(): Promise<any> {
  return await fetch(`${process.env.REST_URL}/gov/proposals?status=PROPOSAL_STATUS_VOTING_PERIOD`)
}

async function checkProposals(channel: any) {
  var known = await storage.getItem('knownProposals') || []
  let update = false

  const response = await getProps()
    .then(res => res.json())
    .then(json => {
      for (const prop of json.result){
        if (!known[prop.id]){
            known[prop.id] = prop
            update = true;
            const propEmbed = new MessageEmbed()
              // @ts-ignore
              //.setColor(getColor(punkID))
              .setTitle(`New Governance proposal on ${process.env.CHAIN_NAME}`)
              .setURL(`${process.env.EXPLORER_URL}${prop.id}`)
              .setDescription(`Proposal ${prop.id} **${prop.content.value.title}** has entered voting period.`)
              .setTimestamp()
            channel.send({ embeds: [propEmbed] })
          }
      }
    })

  if (update){
    await storage.setItem('knownProposals', known)
  }
}

async function checkVotes(channel:any) {
  console.log("Checking votes");
  const response = await fetch(`${process.env.REST_URL}/gov/proposals?status=PROPOSAL_STATUS_VOTING_PERIOD`)
    .then(res => res.json())
    .then(json => {
      //@ts-ignore
      for (const prop of json.result){
        let vote = checkVoted(prop.id);
        //console.log(vote);
        vote.then(res => res.json())
        .then(json => {
          console.log(json)
        })
        .catch(err => {
          const voteEmbed = new MessageEmbed()
            // @ts-ignore
            .setColor("#fc0303")
            .setTitle(`Proposal **${prop.content.value.title}** on ${process.env.CHAIN_NAME}`)
            .setURL(`${process.env.EXPLORER_URL}${prop.id}`)
            .setDescription(`${process.env.VOTER_NAME} has not voted on proposal ${prop.id} "**${prop.content.value.title}**".`)
            .setTimestamp()
          channel.send({ embeds: [voteEmbed] })
        })

      }
    })
}

async function checkVoted(id: number) {
  console.log(`${process.env.REST_URL}/gov/proposals/${id}/votes/${process.env.VOTER_ADDRESS}`)
  return await fetch(`${process.env.REST_URL}/gov/proposals/${id}/votes/${process.env.VOTER_ADDRESS}`)
}


const client = new Client({
  
  simpleCommand: {
    prefix: "!",
  },
  intents: [
    Intents.FLAGS.GUILDS,
    /*Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    */
  ],
  // If you only want to use global commands only, comment this line
  //botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

  silent: true,
});

client.once("ready", async () => {
  // make sure all guilds are in cache
  await client.guilds.fetch();

  // init all application commands
  await client.initApplicationCommands({
    guild: { log: true },
    global: { log: true },
  });

  // init permissions; enabled log to see changes
  await client.initApplicationPermissions(true);

  // uncomment this line to clear all guild commands,
  // useful when moving to global commands from guild commands
  //  await client.clearApplicationCommands(
  //    ...client.guilds.cache.map((g) => g.id)
  //  );
  console.log("Bot started");

  //initialize persistent storage
  await storage.init( /* options ... */ );

  //get channel to send announcements in
  // @ts-ignore
  const guild = client.guilds.cache.get(process.env.SERVER_ID);
  // @ts-ignore
  const channel = guild.channels.cache.get(process.env.CHANNEL_ID);

  //run at bot start
  //intervalFunc(channel)

  //setup loop
  // @ts-ignore
  //setInterval(function() {intervalFunc(channel)}, process.env.INTERVAL);
  //checkProposals(channel);

  var job = new CronJob('0 * * * * *', function() {
    checkProposals(channel);
  }, null, true, 'America/New_York');
  job.start(); 

  var job2 = new CronJob('0 18 * * * *', function() {
    checkVotes(channel);
  }, null, true, 'America/New_York');
  job2.start(); 
  

});

async function run() {
  // with cjs
  // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");
  // with ems
  //await importx(dirname(import.meta.url) + "/{events,commands}/**/*.{ts,js}");
  client.login(process.env.BOT_TOKEN ?? ""); // provide your bot token
}

run();
