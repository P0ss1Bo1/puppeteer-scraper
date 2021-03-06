const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const puppeteer = require("puppeteer");
const express = require("express");

// create socket.io server
const app = express();
const server = http.createServer(app);
const io = socketio(server);

let seedVideoId = "Nu2Xo0Sgd24"; // first video in crawl path
let videoId = seedVideoId;
let crawlLength = 0;

const XMLHttpRequest = require("xhr2");
const Http = new XMLHttpRequest();
Http.responseType = "json";
Http.readyState = 4;

// set static folder
app.use(express.static(path.join(__dirname, "public")));

// run when client connects
io.on("connection", (socket) => {
  console.log("New websocket connection...");

  // welcome current user
  socket.emit("message", {
    id: videoId,
    message: "ID: " + videoId + ", Crawl length: " + crawlLength,
  });
});

const PORT = process.env.port || 5000;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function crawlYoutube() {
  // start browser and open page
  const browser = await puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      `--window-size=${1920},${1080}`,
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });
  console.log("Test: Opened browser");
  const page = await browser.newPage();
  console.log("Test: Opened new page");
  page.setDefaultTimeout(30000);

  // make a bunch of screenshots to see what the bot is doing
  screenshotInterval = setInterval(() => {
    page.screenshot({ path: "browser.png" });
  }, 5000);

  try {
    // go to video id of seed video
    await page.goto("https://www.youtube.com/watch?v=" + videoId);
    console.log(
      "Test: Went to " + "https://www.youtube.com/watch?v=" + videoId
    );

    // close cookies dialog
    let elem = await page.waitForXPath(
      "//*[@aria-label='Agree to the use of cookies and other data for the purposes described']"
    );
    await elem.click();
    console.log("Test: Clicked on accept cookies");

    while (true) {
      // get first next video
      elem = await page.waitForXPath(
        "//ytd-compact-video-renderer//yt-interaction[contains(@class, 'ytd-compact-video-renderer')]"
      );
      console.log("Test: Got first recommended video element");

      // get video id of next video
      let elems_href = await page.$x("//ytd-compact-video-renderer//a");
      let elem_href = elems_href[0];
      let href = await elem_href.getProperty("href");
      let raw_href = await href.jsonValue();
      let current_videoId = raw_href.substring(raw_href.indexOf("=") + 1);
      videoId = current_videoId;
      console.log("Test: Got video id");

      // check if video is embeddable
      canSkipVideo = false;
      Http.open(
        "GET",
        "https://www.googleapis.com/youtube/v3/videos?id=" +
          videoId +
          "&key=AIzaSyDSCiGd1GZJmcU9xPd7O-rSPjNkS4fp61k&part=status"
      );
      Http.send();
      Http.onreadystatechange = (e) => {
        if (Http.readyState == 4 && Http.status == 200) {
          if (Http.response != null) {
            console.log("Test: Got response from Youtube API for video " + current_videoId);
            if (!Http.response.items[0].status.embeddable) {
              canSkipVideo = true;
              console.log(
                `${current_videoId} is not embeddable, skipping to next video`
              );
            }
            Http.onreadystatechange = undefined;
          }
        }
      };
      console.log("Test: Sent YouTube API request");

      // go to next video
      await elem.click();
      console.log("Test: Clicked on next video");

      crawlLength++;

      // send video id and page title to clients
      io.emit("message", {
        id: videoId,
        message: "ID: " + videoId + ", Crawl length: " + crawlLength,
      });
      console.log("Test: Sent message to clients");

      console.log(videoId);

      // wait for play button to appear
      await delay(1000);

      if (!canSkipVideo) {
        // stop playing new video
        let elem_play_button = await page.waitForXPath(
          "//ytd-watch-flexy//button[@class='ytp-play-button ytp-button']"
        );
        await elem_play_button.click();
        console.log("Test: Paused video and waiting");

        // show video for 10 seconds
        await delay(10000);
      }
      console.log("Test: Skipped video");
    }
  } catch (error) {
    console.log("Error encountered while crawling YouTube, restarting browser");
    page.screenshot({ path: "puppeteerError.png" });
    // stop trying to make screenshots of dead page
    clearInterval(screenshotInterval);
    await browser.close();
    // restart whole crawl process
    crawlYoutube();
    return;
  }
}

// makes async function wait
function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

// start crawling ad infinitum
crawlYoutube();
