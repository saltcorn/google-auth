/*global saltcorn*/

import { Browser } from "@capacitor/browser";
import { showAlerts } from "../../helpers/common";


export async function startLogin(strategyName) {
  try {
    const state = saltcorn.data.state.getState();
    await Browser.open({
      url: `${state.mobileConfig.server_path}/auth/login-with/${strategyName}?source=mobile_app`,
    });
  } catch (error) {
    console.error(error);
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}

export async function finishLogin(token) {
  const { login, handleToken } = await import("../../helpers/auth");
  try {
    // legacy support for handleToken or use login with the token parameter
    if (handleToken) await handleToken(token);
    else await login({token});
  } catch (error) {
    console.error(error);
    showAlerts([
      {
        type: "error",
        msg: error.message ? error.message : "An error occured.",
      },
    ]);
  }
}
