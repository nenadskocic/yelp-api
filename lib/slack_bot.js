const Bot = require("slackbots");
const Application = require("./application.js");
const Yelp = require("./yelp.js");
const dotenv = require("dotenv").config();

class SlackBot {
  constructor(handle = "yelphelp") {
    this.handle = handle;
    this.ready = false;
    this.yelp = new Yelp();

    this.settings = {
      token: process.env.SLACK_TOKEN,
      name: this.handle,
    };

    this.instance = new Bot(this.settings);

    this.instance.on("start", this.started.bind(this));
    this.instance.on("message", this.messaged.bind(this));
  }

  // Event callback for Slack API 'start' event
  started() {
    this.ready = true;
    console.log("SlackBot is ready.");
  }

  // Event callback for Slack API 'message' event
  messaged(data) {
    let sb = this; // Create a reference to "this" for later

    if (data.subtype) return; // We only want messages from a person

    // Check which type of data we are receiving
    switch (data.type) {
      // It's a 'message'
      case "message":
        let user_id_from = data.user; // The User ID of the person who sent us the message
        let command_regex = /(\w{0,}).+/gim;
        let command_processed = this.process_message_text(
          command_regex,
          data.text
        );
        let command = command_processed[
          Application.PROCESSED_TEXT_COMMAND
        ].toLowerCase();

        // Lowkey, we're likely going to use NLP (natural language processing) to figure out
        // what arguments were passed. We'll talk about this on Thursday, so look out for that.
        // https://github.com/axa-group/nlp.js/blob/HEAD/docs/v4/quickstart.md#create-the-code
        // Alternatively, we can use boring ol' regular expressions. We'll go over both
        // implementations.

        // Get the user that sent this message first
        let user = this.get_user_by_id(user_id_from)
          .then((user) => {
            if (!user) return false; // No user? Stop everything!

            // Which command are we responding to?
            // nearby, events, top, closest, findme, reviews, searchbyphone, statusupdate
            switch (command) {
              // This is provided as an example to help you with the other commands
              // Expected input: SearchByPhone 19055555555
              case "searchbyphone":
                let sbp_regex = /(\w{0,}) (\d{0,11})/gim;
                let arguments_processed = this.process_message_text(
                  sbp_regex,
                  data.text
                );
                let phone_number =
                  arguments_processed[Application.PROCESSED_TEXT_PHONE]; // Get phone number            

                let formatted_message = `No restaurant found using that phone number.`; // Default message

                if (!phone_number) return false; // If no phone number is passed, we can stop here.
                // Use yelp.js to respond to the user's request:
                this.yelp
                  .get_restaurant_by_phone_number(phone_number)
                  .then((data) => {
                    // data will be an object or FALSE (error)
                    if (data) {
                      // Convert data to JSON object
                      let returned_data = JSON.parse(data);

                      if (returned_data.businesses[0]) {
                        // We only want the first result, so let's make sure it exists
                        let restaurant = returned_data.businesses[0]; // Save a reference that's easier to refer to

                        // There are a bunch of ways to format strings in JavaScript.
                        // If you wanted to go the extra kilometer, you could create templates for the responses
                        // i.e. ./templates/get_restaurant_by_phone_number.txt, then preprocess the string with the
                        // variables needed in the "template."

                        // Also, if you want to make the responses more "fun":
                        // https://api.slack.com/reference/surfaces/formatting#visual-styles

                        formatted_message = `*Hey <@${user_id_from}>, I think I found what you're looking for:*>${restaurant["name"]}> ${restaurant["location"]["address1"]},${restaurant["location"]["city"]}> ${restaurant["phone"]}`;
                      }
                    }

                    // Post the message to the channel, and tag the user that asked for it
                    sb.post_to_channel("general", formatted_message);
                  });
                break;

              case "nearby":
                let nRegex = /\d{1,6}\s(?:[A-Za-z0-9#]+\s){0,3}(?:[A-Za-z0-9#]+,)\s*(?:[A-Za-z]+\s){0,3}(?:[A-Za-z]+,)\s*(?:[A-Za-z]+,)\s*(?:[A-Za-z]+)/gim;
                let n_arguments_processed = this.process_message_text(nRegex, data.text);
                let address = n_arguments_processed[Application.PROCESSED_TEXT_ADDRESS];
                let error = "No nearby restaurants can be found.";

                if (!address) {
                  return sb.post_to_channel("general", error); 
                }
                
                let limit = 5;
                let radius = 10000;

                this.yelp
                  .get_nearby_restaurants_by_address(address, limit, radius)
                  .then((data) => {
                    if (data) {
                      let returned_data = JSON.parse(data);
                      let i = 0;
                      let restaurant = "";
                      let bot = `*Hey <@${user_id_from}>, ${limit} nearby locations:*\n`;

                      for (i = 0; i < returned_data.businesses.length; i++) {
                        restaurant += i + 1 + ". " + returned_data.businesses[i].name + ", " + returned_data.businesses[i].location.address1 + ", " + returned_data.businesses[i].location.city
                        + ", " + returned_data.businesses[i].location.state + ", " + returned_data.businesses[i].location.country + "\n";
                      }  
                      sb.post_to_channel("general", bot + restaurant);             
                    }
                  });
                break;
                     
              case "top":
                let tRegex = /([a-zA-Z].+[^\s]) (\d+[^\s]) (\d+[^\s]) ([A-Za-z].+[^,\s]), ([A-Za-z].+[^,\s]), ([A-Za-z].+[^,\s])/gim;
                let t_arguments_processed = this.process_message_text(tRegex, data.text);
                let tLocation = t_arguments_processed[Application.PROCESSED_TEXT_TOP];
                let xNumber = t_arguments_processed[Application.PROCESSED_TEXT_XNUMBER];

                let tError = "No nearby restaurants can be found";

                if (!tLocation) {
                  return sb.post_to_channel("general", tError); 
                }
                
                let tLimit = xNumber;
                let tRadius = 10000;

                this.yelp
                  .get_top_restaurants_by_address(tLocation, tLimit, tRadius)
                  .then((data) => {
                    if (data) {
                      let returned_data = JSON.parse(data);
                      let i = 0;
                      let tRestaurant = "";
                      let tBot = `*Hey <@${user_id_from}>, top ${tLimit} locations:*\n`;

                      for (i = 0; i < returned_data.businesses.length; i++) {
                        tRestaurant += i + 1 + ". " + returned_data.businesses[i].name + ", " + returned_data.businesses[i].location.address1 + ", " + returned_data.businesses[i].location.city
                        + ", " + returned_data.businesses[i].location.state + ", " + returned_data.businesses[i].location.country + ", " + "*(Rating " + returned_data.businesses[i].rating + ")*" + "\n";
                      }  
                      sb.post_to_channel("general", tBot + tRestaurant);  
                    }
                  });
                break;

              case "closeby":
                let eRegex = /([-+]?)([\d]{1,2})(((\.)(\d+)))(\w)(\s*)(([-+]?)([\d]{1,3})((\.)(\d+))(\w)?)$/gim;
                let e_arguments_processed = this.process_message_text(eRegex, data.text);
                let eCoordinates = e_arguments_processed[Application.PROCESSED_TEXT_EVENTS];
                let latitude = e_arguments_processed[Application.PROCESSED_TEXT_LATITUDE];
                let longitude = e_arguments_processed[Application[0]];

                console.log("coordinates", eCoordinates);
                console.log("latitude", latitude);
                console.log("latitude", longitude);

                let eError = "No close by events can be found.";

                if (!eCoordinates) {
                  return sb.post_to_channel("general", eError); 
                }
                
                let eLimit = 5;
                let eRadius = 10000;

                this.yelp
                  .get_events_by_coordinates(latitude, longitude, eLimit, eRadius)
                  .then((data) => {
                    if (data) {
                      let returned_data = JSON.parse(data);
                      let i = 0;
                      let events = "";
                      let eBot = `*Hey <@${user_id_from}>, ${eLimit} events at your provided coordinates:*\n`;

                      for (i = 0; i < returned_data.events.length; i++) {
                        events += i + 1 + ". " + returned_data.events[i].name + ", " + returned_data.events[i].location.address1 + ", " + returned_data.events[i].location.city
                        + ", " + returned_data.businesses[i].events.state + ", " + returned_data.events[i].location.country + ", " + "*(Rating " + returned_data.events[i].rating + ")*" + "\n";
                      }  
                      sb.post_to_channel("general", eBot + events);  
                    }
                  });
                break;
            }
          })
          .catch((err) => {
            console.log(err);
            return false;
          });

        break;
    }
  }

  // Allows for posting to a specific channel
  post_to_channel(channel, message) {
    if (this.ready) this.instance.postMessageToChannel(channel, message);
  }

  // Allows for posting to a specific user
  post_to_user(username, message) {
    if (this.ready) this.instance.postMessageToUser(username, message);
  }

  // Get user information by UserID, from Slack API
  async get_user_by_id(user_id) {
    if (this.ready) {
      // https://npmdoc.github.io/node-npmdoc-slackbots/build/apidoc.html
      return this.instance
        .getUserById(user_id)
        .then((data) => {
          return data;
        })
        .catch((err) => {
          return false;
        });
    } else {
      return false;
    }
  }

  process_message_text(regex, text) {
    let return_value = [];
    let matches;

    // First we check that there are matches with the supplied RegEx
    while ((matches = regex.exec(text)) !== null) {

      // Let's go through each match and add them to an array that we will return back to the caller
      // The first element in the array will contain the whole string, then each element after will
      // contain an argument in the string, that matches the RegEx pattern.
      // e.g.
      //  Text: 'SearchByPhone 19055555555'
      //  Response: ['SearchByPhone 1905555555', 'SearchByPhone', '1905555555']
      //  So if you want to get the phone number in this example, you'd want index 2
      for (let match = 0; match < matches.length; match++) {
        if (matches[match]) return_value.push(matches[match]);
      }
    }
    console.log(return_value);
    return return_value;
  }
}

module.exports = SlackBot;
