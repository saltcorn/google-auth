const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("@saltcorn/data/models/user");
const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");

const { getState } = require("@saltcorn/data/db/state");

const ensure_final_slash = (s) => (s.endsWith("/") ? s : s + "/");

const authentication = (config) => {
  const cfg_base_url = getState().getConfig("base_url");
  const params = {
    clientID: config.clientID || "nokey",
    clientSecret: config.clientSecret || "nosecret",
    callbackURL: `${ensure_final_slash(cfg_base_url)}auth/callback/google`,
  };
  return {
    google: {
      icon: '<i class="fab fa-google"></i>',
      label: "Google",
      parameters: { scope: ["profile", "email"] },
      strategy: new GoogleStrategy(params, function (
        accessToken,
        refreshToken,
        profile,
        cb
      ) {
        getState().log(6, "google-auth profile: " + JSON.stringify(profile));
        let email = "";
        if (profile._json && profile._json.email) email = profile._json.email;
        else if (profile.emails && profile.emails.length)
          email = profile.emails[0].value;
        if (config.only_existing) {
          // first try existing google id
          User.findOne({
            _attributes: { json: ["googleId", profile.id] },
          }).then((mu) => {
            if (mu?.disabled) return cb(null, false);
            if (mu?.auth_method_allowed && !mu.auth_method_allowed("google"))
              return cb(null, false);
            if (mu) return cb(null, mu.session_object);

            // no exisiting, check if it has email
            User.findOne({ email }).then((mu) => {
              if (!mu || mu.disabled) return cb(null, false);
              if (
                mu._attributes.googleId &&
                mu._attributes.googleId !== profile.id
              ) {
                //there is a user but it has a different google id. Reject
                return cb(null, false);
              }
              // set profile id & proceed
              mu.update({
                _attributes: { ...mu._attributes, googleId: profile.id },
              }).then(() => {
                return cb(null, mu.session_object);
              });
            });
          });
        } else {
          User.findOrCreateByAttribute("googleId", profile.id, {
            email,
          }).then((u) => {
            if (!u) return cb(null, false);
            return cb(null, u.session_object);
          });
        }
      }),
    },
  };
};

const configuration_workflow = () => {
  const cfg_base_url = getState().getConfig("base_url");
  const blurb = [
    !cfg_base_url
      ? "You should set the 'Base URL' configration property. "
      : "",
    `Create a new application at the <a href="https://console.developers.google.com/apis/credentials">Google developer portal, API & Services, Credentials</a>. 
you should obtain a OAuth 2.0 Client ID and secret, set the Authorised JavaScript origins to ${cfg_base_url}
and set the Authorised redirect URI to ${ensure_final_slash(
      cfg_base_url
    )}auth/callback/google. HTTPS should be enabled.`,
  ];
  return new Workflow({
    steps: [
      {
        name: "API keys",
        form: () =>
          new Form({
            labelCols: 3,
            blurb,
            fields: [
              {
                name: "clientID",
                label: "Google Client ID",
                type: "String",
                required: true,
              },
              {
                name: "clientSecret",
                label: "Google Client Secret",
                type: "String",
                required: true,
              },
              {
                name: "only_existing",
                label: "Only existing",
                sublabel:
                  "Only allow logins from emails or Google IDs with existing user accounts",
                type: "Bool",
              },
            ],
          }),
      },
    ],
  });
};

module.exports = {
  sc_plugin_api_version: 1,
  authentication,
  configuration_workflow,
};
