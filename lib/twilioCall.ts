import { getAdminSettings, logCallEvent } from "./db";

export async function triggerOutboundCall(customerPhone: string, orderId: string, origin: string) {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
      console.log("[Twilio Call] Missing Twilio credentials or phone number for outbound call.");
      return;
    }

    if (!customerPhone) {
      console.log("[Twilio Call] No customer phone number provided.");
      return;
    }

    // Clean customer phone number to make sure it's valid format
    let cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length === 10) cleanPhone = "+1" + cleanPhone;
    else if (cleanPhone.length === 11 && cleanPhone.startsWith("1")) cleanPhone = "+" + cleanPhone;
    else if (cleanPhone.length >= 7) cleanPhone = "+" + cleanPhone;

    let fromPhone = settings.twilioPhoneNumber.replace(/\D/g, "");
    if (fromPhone.length === 10) fromPhone = "+1" + fromPhone;
    else if (fromPhone.length === 11 && fromPhone.startsWith("1")) fromPhone = "+" + fromPhone;
    else if (fromPhone.length >= 7) fromPhone = "+" + fromPhone;

    const auth = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Calls.json`;

    const body = new URLSearchParams();
    body.append("To", cleanPhone);
    body.append("From", fromPhone);
    body.append("Url", `${origin}/api/twilio/outbound?orderId=${orderId}`);
    
    // Status callbacks to log if the call was answered, went to voicemail, failed, etc.
    body.append("StatusCallback", `${origin}/api/twilio/call-status?orderId=${orderId}`);
    body.append("StatusCallbackEvent", "completed");
    body.append("StatusCallbackMethod", "POST");

    console.log(`[Twilio Call] Initiating outbound call to ${cleanPhone} from ${fromPhone}`);

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Twilio Call] Failed to initiate call: ${res.status} ${errorText}`);
      return false;
    } else {
      try {
        const callData = await res.json();
        const callSid = callData.sid;
        console.log(`[Twilio Call] Outbound call initiated successfully. CallSid: ${callSid}`);
        
        // Log the automated outbound notification call in the call logs
        await logCallEvent(
          callSid, 
          cleanPhone, 
          `Automated Order Ready Call (Order #${orderId})`, 
          "active", 
          undefined, 
          "outbound",
          orderId
        );
      } catch (logErr) {
        console.error("[Twilio Call] Failed to log call event for outbound call:", logErr);
      }
      return true;
    }
  } catch (error) {
    console.error("[Twilio Call] Error initiating outbound call:", error);
    return false;
  }
}

export async function triggerCallBridge(
  customerPhone: string,
  adminPhone: string,
  origin: string,
  customerName?: string,
  orderId?: string
) {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
      console.log("[Twilio Bridge] Missing Twilio credentials or phone number for call bridge.");
      return { success: false, error: "Missing Twilio configuration settings" };
    }

    if (!customerPhone) {
      console.log("[Twilio Bridge] No customer phone number provided.");
      return { success: false, error: "No customer phone number provided" };
    }

    if (!adminPhone) {
      console.log("[Twilio Bridge] No admin phone number provided.");
      return { success: false, error: "No admin phone number provided" };
    }

    // Clean phone numbers
    let cleanCustomer = customerPhone.replace(/\D/g, "");
    if (cleanCustomer.length === 10) cleanCustomer = "+1" + cleanCustomer;
    else if (cleanCustomer.length === 11 && cleanCustomer.startsWith("1")) cleanCustomer = "+" + cleanCustomer;
    else if (cleanCustomer.length >= 7) cleanCustomer = "+" + cleanCustomer;

    let cleanAdmin = adminPhone.replace(/\D/g, "");
    if (cleanAdmin.length === 10) cleanAdmin = "+1" + cleanAdmin;
    else if (cleanAdmin.length === 11 && cleanAdmin.startsWith("1")) cleanAdmin = "+" + cleanAdmin;
    else if (cleanAdmin.length >= 7) cleanAdmin = "+" + cleanAdmin;

    let fromPhone = settings.twilioPhoneNumber.replace(/\D/g, "");
    if (fromPhone.length === 10) fromPhone = "+1" + fromPhone;
    else if (fromPhone.length === 11 && fromPhone.startsWith("1")) fromPhone = "+" + fromPhone;
    else if (fromPhone.length >= 7) fromPhone = "+" + fromPhone;

    const auth = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Calls.json`;

    const body = new URLSearchParams();
    body.append("To", cleanAdmin);
    body.append("From", fromPhone);
    
    let callbackUrl = `${origin}/api/twilio/bridge-call/callback?customerPhone=${encodeURIComponent(cleanCustomer)}`;
    if (customerName) callbackUrl += `&customerName=${encodeURIComponent(customerName)}`;
    if (orderId) callbackUrl += `&orderId=${encodeURIComponent(orderId)}`;
    
    body.append("Url", callbackUrl);
    body.append("StatusCallback", `${origin}/api/twilio/call-status-callback`);
    body.append("StatusCallbackEvent", "completed");
    body.append("StatusCallbackMethod", "POST");

    console.log(`[Twilio Bridge] Initiating call bridge: calling admin ${cleanAdmin}, will dial customer ${cleanCustomer} (${customerName || "No Name"}, Order: ${orderId || "No Order"})`);

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Twilio Bridge] Failed to initiate bridge call: ${res.status} ${errorText}`);
      return { success: false, error: `Twilio Error: ${res.status} ${errorText}` };
    } else {
      const callData = await res.json();
      const callSid = callData.sid;
      
      // Log the outbound call in our general calls log database
      let logName = customerName ? `Outbound: ${customerName}` : "Outbound Call";
      await logCallEvent(callSid, cleanCustomer, logName, "active", undefined, "outbound");
      
      console.log(`[Twilio Bridge] Bridge call initiated successfully. CallSid: ${callSid}`);
      return { success: true };
    }
  } catch (error: any) {
    console.error("[Twilio Bridge] Error initiating bridge call:", error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function sendSms(customerPhone: string, message: string) {
  try {
    const settings = await getAdminSettings();
    if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioPhoneNumber) {
      console.log("[Twilio SMS] Missing Twilio credentials or phone number.");
      return { success: false, error: "Missing Twilio configuration settings" };
    }

    if (!customerPhone || !message) {
      return { success: false, error: "Missing customer phone or message body" };
    }

    let cleanCustomer = customerPhone.replace(/\D/g, "");
    if (cleanCustomer.length === 10) cleanCustomer = "+1" + cleanCustomer;
    else if (cleanCustomer.length === 11 && cleanCustomer.startsWith("1")) cleanCustomer = "+" + cleanCustomer;
    else if (cleanCustomer.length >= 7) cleanCustomer = "+" + cleanCustomer;

    let fromPhone = settings.twilioPhoneNumber.replace(/\D/g, "");
    if (fromPhone.length === 10) fromPhone = "+1" + fromPhone;
    else if (fromPhone.length === 11 && fromPhone.startsWith("1")) fromPhone = "+" + fromPhone;
    else if (fromPhone.length >= 7) fromPhone = "+" + fromPhone;

    const auth = Buffer.from(`${settings.twilioAccountSid}:${settings.twilioAuthToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${settings.twilioAccountSid}/Messages.json`;

    const body = new URLSearchParams();
    body.append("To", cleanCustomer);
    body.append("From", fromPhone);
    body.append("Body", message);

    console.log(`[Twilio SMS] Sending SMS to ${cleanCustomer} from ${fromPhone}`);

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Twilio SMS] Failed to send SMS: ${res.status} ${errorText}`);
      return { success: false, error: `Twilio Error: ${res.status} ${errorText}` };
    } else {
      const data = await res.json();
      console.log(`[Twilio SMS] SMS sent successfully. Sid: ${data.sid}`);
      return { success: true, sid: data.sid };
    }
  } catch (error: any) {
    console.error("[Twilio SMS] Error sending SMS:", error);
    return { success: false, error: error.message || String(error) };
  }
}


