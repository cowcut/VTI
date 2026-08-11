import { Request } from "express";
import { IUser } from "../models/User.model";

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}
