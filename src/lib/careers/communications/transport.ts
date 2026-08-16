import "server-only";

import nodemailer from "nodemailer";
import { getCareerMailConfig } from "./config";
import {
  CareerMailTransportError,
  deliverCareerMail,
  type CareerTransportFactory,
} from "./smtp-delivery";
import type { RenderedCareerCommunication } from "./types";

export { CareerMailTransportError } from "./smtp-delivery";

export async function sendCareerMail(
  input: {
    to: string;
    message: RenderedCareerCommunication;
  },
  transportFactory: CareerTransportFactory = (options) =>
    nodemailer.createTransport(options),
) {
  try {
    return await deliverCareerMail(
      { ...input, config: getCareerMailConfig() },
      transportFactory,
    );
  } catch (error) {
    if (error instanceof CareerMailTransportError) throw error;
    throw new CareerMailTransportError("email_not_configured");
  }
}
