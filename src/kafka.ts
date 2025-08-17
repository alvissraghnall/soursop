import { Kafka, Producer, Consumer } from "kafkajs";

const kafka = new Kafka({
  clientId: "soursop",
  brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
});

export const producer = kafka.producer();

export const consumer = kafka.consumer({ groupId: "price-group" });

export async function connectKafka() {
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: "price-updates", fromBeginning: false });
  console.log("Kafka connected!");
}
