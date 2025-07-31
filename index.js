const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const Trigger = require("@saltcorn/data/models/trigger");
const cluster = require("cluster");

const mqtt = require("async-mqtt");

let client;

const configuration_workflow = () =>
  new Workflow({
    /* onDone: async (cfg) => {
      await onLoad(cfg);
      return cfg;
    },
*/ steps: [
      {
        name: "MQTT configuration",
        form: () =>
          new Form({
            fields: [
              {
                name: "broker_url",
                label: "Broker URL",
                type: "String",
                required: true,
              },
              {
                name: "subscribe_channels",
                label: "Subscribe to channels",
                sublabel: "Separate by commas if more than one",
                type: "String",
                required: true,
              },
              {
                name: "is_json",
                label: "Messages are JSON",
                type: "Bool",
              },
            ],
          }),
      },
    ],
  });

const onLoad = async (cfg) => {
  if (!cfg) return;

  const { broker_url, subscribe_channels, is_json } = cfg;
  if (client) await client.end();
  const broker_url1 = broker_url.includes("://")
    ? broker_url
    : `mqtt://${broker_url}`;
  client = mqtt.connect(broker_url1, { reconnectPeriod: 1000 });

  if (!cluster.isMaster) return;

  client.on("connect", function () {
    for (const channel of subscribe_channels.split(","))
      client.subscribe(channel.trim());
  });
  client.on("message", function (topic, message) {
    //console.log("MQTT", topic, message);
    try {
      const payload = is_json
        ? JSON.parse(message.toString())
        : message.toString();
      Trigger.emitEvent("MqttReceive", topic, null, payload);
    } catch (e) {
      console.error("mqtt message parsing error: ", e);
    }
  });
};

module.exports = {
  sc_plugin_api_version: 1,
  configuration_workflow,
  onLoad,
  actions: () => ({
    mqtt_publish: {
      configFields: [{ name: "channel", label: "Channel", type: "String" }],
      run: async ({ row, configuration: { channel } }) => {
        client.publish(channel, JSON.stringify(row));
      },
    },
  }),
  eventTypes: () => ({
    MqttReceive: {
      hasChannel: true,
    },
  }),
};
