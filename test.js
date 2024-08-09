import axios from "axios";

const fetchPerformerIdAndURL = async (artistName)=> {
    const formData = new FormData();
    formData.append("text", artistName);
    formData.append("searchGuid", "E1BCC8EE-CE62-49F5-9497-3656CE041C89");
    formData.append("searchType", "2");
    try {
      const { data } = await axios.post(
        "https://www.stubhub.com/search/groupedsearch?FormatDate=true",
        formData
      );
      const result = data.resultsWithMetadata;
      for (const item of result) {
        if (item.results.desc === "Top Result") {
          const topResults = item.results.results;
          for (const result of topResults) {
            if (
              result.title === artistName &&
              result.url.split("/")[2] === "performer"
            ) {
              console.log({id: result.id, url: result.url.split("?")[0]});
              return { id: result.id, url: result.url.split("?")[0]};
            }
          }
        }
      }

      return "Hello world";
    } catch (error) {
    console.error(`Error in fetchPerformerIdAndURL: ${error}`);
      return null;
    }
};



const fetchEventURL = async ()=> {
    const performer = await fetchPerformerIdAndURL("Clairo");
    if (!performer) {
      return null;
    }
    const stubhubURL = "https://www.stubhub.com";
    try {
      const url = stubhubURL + performer.url;
      const eventDate = "2024-09-08";
      const params = {
        sortBy: 0,
        pageIndex: 0,
        method: "GetFilteredEvents",
        categoryId: performer.id,
        from: `${eventDate}T00:00:00.000Z`,
        to: `${eventDate}T23:59:59.999Z`,
        countryCode: "US",
      };
  
      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: url,
        params: params,
        headers: {},
      };
      let eventURL;
  
      const { data } = await axios(config);
      if (data.items && data.items.length > 0) {
        eventURL = data.items[0].url;
        
        // let existingLink = await AffiliateLink.findOne({
        //   url: eventURL,
        //   provider: "STUBHUB",
        // });
        // let result = null;
  
        // if (existingLink) {
        //   result = { url: eventURL, affiliate: existingLink.vanityLink };
        // } else {
        //   const affiliateLink = await getAffiliateLink(eventURL);
        //   if (affiliateLink) {
        //     await AffiliateLink.create({
        //       url: eventURL,
        //       vanityLink: affiliateLink,
        //       provider: "STUBHUB",
        //       eventTime: eventDate,
        //     });
        //     result = { url: eventURL, affiliate: affiliateLink };
        //   }
        // }
        return eventURL;
      } else {
        console.error(
          `Error in stubhub fetchEventURL - No events found ${artistName}`
        );
        return null;
      }
    } catch (error) {
      console.error(`Error in fetchEventURL: ${error}`);
      return null;
    }
};

fetchEventURL().then((data) => console.log(data));