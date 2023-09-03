"use server";

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";

interface Params {
    text: string,
    author: string,
    communityId: string | null,
    path: string
}

export const createThread = async ({text, author, communityId, path }: Params): Promise<void> => {
    connectToDB();
    const createThread = await Thread.create({
        text,
        author,
        community: null
    });

    await User.findByIdAndUpdate(author, {
        $push: { threads: createThread._id }
    })

    revalidatePath(path);
};

export const fetchThreads = async (pageNumber = 1, pageSize = 20) => {
    connectToDB();
    const threadSkipAmmount = (pageNumber - 1) * pageSize;

    const threadsQuery = Thread.find({
        parentId: { $in: [null, undefined] }
    })
    .sort({
        createdAt: 'desc'
    })
    .skip(threadSkipAmmount)
    .limit(pageSize)
    .populate({ 
        path: 'author', model: User
    })
    .populate({
        path: 'children',
        populate: {
            path: 'author',
            model: User,
            select: "_id name parentId image"
        }
    });

    const totalThreadsCount = await Thread.countDocuments({
        parentId: { $in: [null, undefined] }
    });

    const threads = await threadsQuery.exec();

    const isNext = totalThreadsCount > threadSkipAmmount | threads.length;

    return { threads, isNext };
}
