import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
import { OidcPlugin } from "../../src/main";
/* 

Example using the identityserver demo...
Authorization Code with PKCE

*/
const oidc = new OidcPlugin({
  authority: "https://demo.duendesoftware.com/",
  client_id: "interactive.public",
  redirect_uri: "http://localhost:5174/signin",
  silent_redirect_uri: "http://localhost:5174/signinsilent",
  automaticSilentRenew: true
},
{
  log: 4,
  logger: console
});

createApp(App).use(oidc).mount("#app");
