import express from "express";
import axios from "axios";
import NodeCache from "node-cache";
import cheerio from "cheerio";

const app = express();
const cache = new NodeCache({ stdTTL: 600 }); 

app.use(express.json());

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
      const scriptContent = $('script#index-data').html().trim();

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

app.get("/fetch-ticket", async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send("URL parameter is required");
  }

  try {
    const response = await axios.get(`https://www.stubhub.com${url}`);
    const $ = cheerio.load(response.data);
    const scriptContent = $('script#index-data').html().trim();

    if (scriptContent) {
      let parsedData;
      try {
        parsedData = JSON.parse(scriptContent);
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return res.status(500).send("Failed to parse JSON from script content");
      }
      const cleanData = cleanJson(parsedData);

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
  if (typeof data !== 'object' || data === null) return data;

  const keysToRemove = ['profileUrl', 'marketplaceDisclosure', 'footer', 'categorySummary','header'];

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
