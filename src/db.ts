import mongoose from "mongoose";
import { MONGO_URI } from "./config";
mongoose.connect(MONGO_URI)
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
    shareId: { type: String, unique: true, sparse: true },
});

const contentSchema = new mongoose.Schema({
    title:String,
    link: String,
    type: String,
    tags: [String],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
},
{timestamps:true});

const shareSchema = new mongoose.Schema({
    shareId: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    contentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Content" }]
});

export const UserModel = mongoose.model("User", userSchema);
export const ContentModel = mongoose.model("Content", contentSchema);
export const ShareModel = mongoose.model("Share", shareSchema);
