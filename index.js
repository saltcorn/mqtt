const Workflow = require("@saltcorn/data/models/workflow");
const Form = require("@saltcorn/data/models/form");

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
            ],
          }),
      },
    ],
  });

const onLoad = async ({ broker_url }) => {
  if (client) await client.end();
  client = mqtt.connect(broker_url);
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
      hasChannelName: true,
      channelNameIsTable: false,
    },
  }),
};
