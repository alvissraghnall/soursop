import { Kafka, Partitioners } from "kafkajs";
import { logger } from "./util/logger";

const kafka = new Kafka({
  clientId: "soursop",
  brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
});

export const producer = kafka.producer({
  createPartitioner: Partitioners.LegacyPartitioner,
});

export const consumer = kafka.consumer({ groupId: "price-group" });

export async function setupKafka() {
  try {
    const admin = kafka.admin();
    await admin.connect();

    // Create topic if it doesn't exist
    await admin.createTopics({
      topics: [
        {
          topic: "price-updates",
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });

    await admin.disconnect();

    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: "price-updates", fromBeginning: false });

    logger.info("Kafka connected and topic created");
  } catch (error) {
    logger.error(error, "Kafka setup error");
  }
}
