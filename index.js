const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");
const Trigger = require("@saltcorn/data/models/trigger");

const mqtt = require("async-mqtt");

let client;

const configuration_workflow = () =>
  new Workflow({
    onDone: async (cfg) => {
      await onLoad(cfg);
      return cfg;
    },
    steps: [
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
                sublabels: "Separate by comma",
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

const onLoad = async ({ broker_url, subscribe_channels, is_json }) => {
  if (client) await client.end();
  client = mqtt.connect(broker_url);
  client.on("connect", function () {
    for (channel of subscribe_channels.split(","))
      client.subscribe(channel.trim());
  });
  client.on("message", function (topic, message) {
    const payload = is_json
      ? JSON.parse(message.toString())
      : message.toString();
    Trigger.emitEvent("MqttReceive", topic, payload);
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
        await client.publish(channel, JSON.stringify(row));
      },
    },
  }),
  eventTypes: () => ({
    MqttReceive: {
      hasChannel: true,
    },
  }),
};
