import express from "express";
import axios from "axios";
import NodeCache from "node-cache";
import cheerio from "cheerio";
import morgan from "morgan";
const app = express();
const cache = new NodeCache({ stdTTL: 600 });

app.use(express.json());
app.use(morgan("dev"));

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.post("/search", async (req, res) => {
  const { text, searchGuid, searchType } = req.query;
  const cacheKey = `${text}-${searchGuid}-${searchType}`;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }

  try {
    const response = await axios.post(
      "https://www.stubhub.com/search/groupedsearch?FormatDate=true",
      {
        text: text,
        searchGuid: searchGuid || "1D5EA06E-C746-455F-B6C0-5968ECB50744",
        searchType: searchType || 2,
      }
    );

    cache.set(cacheKey, response.data);

    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

app.get("/info", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("URL parameter is required");
  }

  const cacheKey = `info-${url}`;

  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }

  try {
    const response = await axios.get(`https://www.stubhub.com${url}`);
    const $ = cheerio.load(response.data);
    const scriptContent = $("script#index-data").html().trim();

    if (scriptContent) {
      let parsedData;
      try {
        parsedData = JSON.parse(scriptContent);
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return res.status(500).send("Failed to parse JSON from script content");
      }
      const cleanData = cleanJson(parsedData);
      cache.set(cacheKey, cleanData);

      res.json(cleanData);
    } else {
      res.status(404).send("Script tag with id='index-data' not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

app.get("/cheap-price", async (req, res) => {
  const { artist, date } = req.query;

  if (!artist) {
    return res.status(400).send("Artist name is required");
  }

  let searchDate;
  if (date) {
    searchDate = new Date(date);
    if (isNaN(searchDate.getTime())) {
      return res
        .status(400)
        .send(
          "Invalid date format. Please use ISO 8601 format (e.g., '2024-08-09T00:00:00Z')"
        );
    }
  }



  try {
    const response = await axios.post(
      "https://www.stubhub.com/search/groupedsearch?FormatDate=true",
      {
        text: artist,
        searchGuid: "1D5EA06E-C746-455F-B6C0-5968ECB50744",
        searchType: 2,
      }
    );
    
    console.log("Search results: " + JSON.stringify(response.data));
    
    if (
      response.data &&
      response.data.resultsWithMetadata &&
      response.data.resultsWithMetadata.length > 0
    ) {
      const topResultGroup = response.data.resultsWithMetadata.find(
        (group) => group.results.desc === "Top Result"
      );
    
      const topPerformerGroup = response.data.resultsWithMetadata.find(
        (group) => group.results.desc === "Performers"
      );
    
      let topResult;
    
      if (
        topResultGroup &&
        topResultGroup.results.results &&
        topResultGroup.results.results.length > 0
      ) {
        topResult = topResultGroup.results.results[0];
      } else if (
        topPerformerGroup &&
        topPerformerGroup.results.results &&
        topPerformerGroup.results.results.length > 0
      ) {
        topResult = topPerformerGroup.results.results[0];
      }
      const url = `https://www.stubhub.com${topResult.url}`;
      console.log(`Fetching additional data from: ${url}`);


      const htmlResponse = await axios.get(url);
      const $ = cheerio.load(htmlResponse.data);
      const scriptContent = $("script#index-data").html().trim();

      if (scriptContent) {
        let parsedData;
        try {
          parsedData = JSON.parse(scriptContent);
        } catch (error) {
          console.error("Failed to parse JSON:", error);
          return res
            .status(500)
            .send("Failed to parse JSON from script content");
        }


        const cleanData = cleanJson(parsedData);

        let allEvents = [];
        for (let grid in cleanData.eventGrids) {
          if (cleanData.eventGrids[grid].items) {
            allEvents = allEvents.concat(cleanData.eventGrids[grid].items);
          }
        }

        if (searchDate) {
          const filteredEvents = allEvents
            .filter((event) => {
              const eventDate = new Date(
                event.formattedDate + ", " + new Date().getFullYear()
              );
              return eventDate >= searchDate;
            })
            .sort((a, b) => {
              const dateA = new Date(
                a.formattedDate + ", " + new Date().getFullYear()
              );
              const dateB = new Date(
                b.formattedDate + ", " + new Date().getFullYear()
              );
              return dateA - dateB;
            });

          if (filteredEvents.length > 0) {
          
            const resultUrl = filteredEvents[0].url;

           
            const resultHtmlResponse = await axios.get(resultUrl);
            const result$ = cheerio.load(resultHtmlResponse.data);
            const resultScriptContent = result$("script#index-data")
              .html()
              .trim();

            if (resultScriptContent) {
              let resultParsedData;
              try {
                resultParsedData = JSON.parse(resultScriptContent);
              } catch (error) {
                console.error("Failed to parse JSON:", error);
                return res
                  .status(500)
                  .send("Failed to parse JSON from script content");
              }

              const resultCleanData = cleanJson(resultParsedData);
           
              console.log(resultCleanData)
              return res.json({"Min Price": resultCleanData.grid.formattedMinPrice, "Max Price": resultCleanData.grid.formattedMaxPrice});
            } else {
              return res
                .status(404)
                .send("Script tag with id='index-data' not found in event URL");
            }
          } else {
            console.log(parsedData)
            return res
              .status(404)
              .send("No events found on or after the specified date");
          }
        } else {
          return res.json(cleanData);
        }
      } else {
        return res
          .status(404)
          .send("Script tag with id='index-data' not found");
      }
    } else {
      return res.status(404).send("No results found");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("An error occurred");
  }
});


app.get("/fetch-ticket", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("URL parameter is required");
  }

  const cacheKey = `fetch-ticket-${url}`;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }

  try {
    const response = await axios.get(`https://www.stubhub.com${url}`);
    const $ = cheerio.load(response.data);
    const scriptContent = $("script#index-data").html().trim();

    if (scriptContent) {
      let parsedData;
      try {
        parsedData = JSON.parse(scriptContent);
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return res.status(500).send("Failed to parse JSON from script content");
      }
      const cleanData = cleanJson(parsedData);
      cache.set(cacheKey, cleanData);

      res.json(cleanData);
    } else {
      res.status(404).send("Script tag with id='index-data' not found");
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

function cleanJson(data) {
  if (typeof data !== "object" || data === null) return data;

  const keysToRemove = [
    "profileUrl",
    "marketplaceDisclosure",
    "footer",
    "categorySummary",
    "header",
    "ticketClasses",
    "sellerListingNotes",
    "ticketTypeGroups",
    "topSellingSectionIds",
    "geoJsonMetadata",
    "listingInfoBySection",
    "listingInfoByTicketClass",
    "histogram",
    "highDemandMessage",
    "listingComplianceDisplayStrategy",
  ];

  if (Array.isArray(data)) {
    return data.map(cleanJson);
  }

  return Object.keys(data).reduce((acc, key) => {
    if (!keysToRemove.includes(key)) {
      acc[key] = cleanJson(data[key]);
    }
    return acc;
  }, {});
}
