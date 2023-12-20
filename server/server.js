import { existsSync } from "fs";
import { createServer } from "http";
import { join } from "path";
import request from "request";

import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
import SpotifyWebApi from "spotify-web-api-node";

import Mfrc522 from "mfrc522-rpi";
import SoftSPI from "rpi-softspi";

const MODE = process.env.NODE_ENV;
const BUILD_DIR = join(process.cwd(), "server/build");

if (!existsSync(BUILD_DIR)) {
  console.warn(
    "Build directory doesn't exist, please run `npm run dev` or `npm run build` before starting the server.",
  );
}

const BUILD_PATH = "./build/index.js";

/**
 * Initial build
 * @type {ServerBuild}
 */
const build = await import(BUILD_PATH);

const app = express();
const httpServer = createServer(app);

var spotify_album_uri = "1UbnWM4Qnw1uKaBuXMUAV0";

// Begin Spotify Login
const scopes = [
  "ugc-image-upload",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "app-remote-control",
  "user-read-email",
  "user-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-read-private",
  "playlist-modify-private",
  "user-library-modify",
  "user-library-read",
  "user-top-read",
  "user-read-playback-position",
  "user-read-recently-played",
  "user-follow-read",
  "user-follow-modify",
];

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

// var authOptions = {
//   url: "https://accounts.spotify.com/api/token",
//   headers: {
//     Authorization:
//       "Basic " +
//       new Buffer.from(
//         process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET,
//       ).toString("base64"),
//   },
//   form: {
//     grant_type: "client_credentials",
//   },
//   json: true,
// };

// request.post(authOptions, function (error, response, body) {
//   if (!error && response.statusCode === 200) {
//     var token = body.access_token;
//     console.log(body);
//     spotifyApi.setAccessToken(token);

//     spotifyApi.getMyDevices().then(
//       function (data) {
//         let availableDevices = data.body.devices;
//         console.log(availableDevices);
//       },
//       function (err) {
//         console.log("Something went wrong!", err);
//       },
//     );

//     // spotifyApi.play({ context_uri: "spotify:album:" + spotify_album_uri }).then(
//     //   function () {
//     //     console.log("Playback started");
//     //   },
//     //   function (err) {
//     //     //if the user making the request is non-premium, a 403 FORBIDDEN response code will be returned
//     //     console.log("Something went wrong!", err);
//     //   },
//     // );
//   }
// });

app.get("/login", (req, res) => {
  res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

//spotifyApi.createAuthorizeURL(scopes);

app.get("/callback", (req, res) => {
  const error = req.query.error;
  const code = req.query.code;
  const state = req.query.state;

  if (error) {
    console.error("Callback Error:", error);
    res.send(`Callback Error: ${error}`);
    return;
  }

  spotifyApi
    .authorizationCodeGrant(code)
    .then((data) => {
      const access_token = data.body["access_token"];
      const refresh_token = data.body["refresh_token"];
      const expires_in = data.body["expires_in"];

      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);

      console.log("access_token:", access_token);
      console.log("refresh_token:", refresh_token);

      console.log(
        `Sucessfully retreived access token. Expires in ${expires_in} s.`,
      );
      res.send("Success! You can now close the window.");

      setInterval(async () => {
        const data = await spotifyApi.refreshAccessToken();
        const access_token = data.body["access_token"];

        console.log("The access token has been refreshed!");
        console.log("access_token:", access_token);
        spotifyApi.setAccessToken(access_token);
      }, (expires_in / 2) * 1000);

      // spotifyApi.getMyDevices().then(
      //   function (data) {
      //     let availableDevices = data.body.devices;
      //     console.log(availableDevices);
      //   },
      //   function (err) {
      //     console.log("Something went wrong!", err);
      //   },
      // );
      // Start/Resume a User's Playback
      // spotifyApi
      //   .play({ context_uri: "spotify:album:" + spotify_album_uri })
      //   .then(
      //     function () {
      //       console.log("Playback started");
      //     },
      //     function (err) {
      //       //if the user making the request is non-premium, a 403 FORBIDDEN response code will be returned
      //       console.log("Something went wrong!", err);
      //     },
      //   );
    })
    .catch((error) => {
      console.error("Error getting Tokens:", error);
      res.send(`Error getting Tokens: ${error}`);
    });
});

// End Spotify Login

// You need to create the HTTP server from the Express app
//const httpServer = createServer(app);

// And then attach the socket.io server to the HTTP server
const io = new Server(httpServer);

// Then you can use `io` to listen the `connection` event and get a socket
// from a client
io.on("connection", (socket) => {
  // from this point you are on the WS connection with a specific client
  console.log(socket.id, "connected");

  socket.emit("confirmation", "connected!");

  socket.on("event", (data) => {
    console.log(socket.id, data);
    socket.emit("event", "pong");
    spotifyApi.play({ context_uri: "spotify:album:" + spotify_album_uri }).then(
      function () {
        console.log("Playback started");
      },
      function (err) {
        //if the user making the request is non-premium, a 403 FORBIDDEN response code will be returned
        console.log("Something went wrong!", err);
      },
    );
  });
});

// ####################

// const softSPI = new SoftSPI({
//   clock: 23, // pin number of SCLK
//   mosi: 19, // pin number of MOSI
//   miso: 21, // pin number of MISO
//   client: 24, // pin number of CS
// });

// // GPIO 24 can be used for buzzer bin (PIN 18), Reset pin is (PIN 22).
// // I believe that channing pattern is better for configuring pins which are optional methods to use.
// const mfrc522 = new Mfrc522(softSPI).setResetPin(22).setBuzzerPin(18);

// setInterval(function () {
//   //# reset card
//   mfrc522.reset();

//   //# Scan for cards
//   let response = mfrc522.findCard();
//   if (!response.status) {
//     console.log("No Card");
//     return;
//   }
//   console.log("Card detected, CardType: " + response.bitSize);
//   //# Get the UID of the card
//   response = mfrc522.getUid();
//   if (!response.status) {
//     console.log("UID Scan Error");
//     return;
//   }
//   //# If we have the UID, continue
//   const uid = response.data;
//   console.log(
//     "Card read UID: %s %s %s %s",
//     uid[0].toString(16),
//     uid[1].toString(16),
//     uid[2].toString(16),
//     uid[3].toString(16),
//   );

//   //# Select the scanned card
//   const memoryCapacity = mfrc522.selectCard(uid);
//   console.log("Card Memory Capacity: " + memoryCapacity);

//   //# This is the default key for authentication
//   const key = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

//   //# Authenticate on Block 8 with key and uid
//   if (!mfrc522.authenticate(8, key, uid)) {
//     console.log("Authentication Error");
//     return;
//   }

//   //# Dump Block 8
//   console.log("Block: 8 Data: " + mfrc522.getDataForBlock(8));

//   //# Stop
//   mfrc522.stopCrypto();
// }, 500);

// ####################

app.use(compression());

// You may want to be more aggressive with this caching
app.use(express.static("public", { maxAge: "1h" }));

// Remix fingerprints its assets so we can cache forever
app.use(express.static("public/build", { immutable: true, maxAge: "1y" }));

app.use(morgan("tiny"));
app.all(
  "*",
  MODE === "production"
    ? createRequestHandler({ build })
    : (req, res, next) => {
        //purgeRequireCache();
        //const build = require("./build");
        return createRequestHandler({ build, mode: MODE })(req, res, next);
      },
);

const port = process.env.PORT || 3000;

// instead of running listen on the Express app, do it on the HTTP server
httpServer.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});

////////////////////////////////////////////////////////////////////////////////
// function purgeRequireCache() {
//   // purge require cache on requests for "server side HMR" this won't let
//   // you have in-memory objects between requests in development,
//   // alternatively you can set up nodemon/pm2-dev to restart the server on
//   // file changes, we prefer the DX of this though, so we've included it
//   // for you by default
//   for (const key in require.cache) {
//     if (key.startsWith(BUILD_DIR)) {
//       delete require.cache[key];
//     }
//   }
// }
