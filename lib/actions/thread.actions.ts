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

export const fetchThreadById = async (id: string) => {
    connectToDB();
    try {
        const thread = await Thread.findById(id)
        .populate({
            path: 'author',
            model: User,
            select: "_id id name image"
        })
        .populate({
            path: 'children',
            populate: [
                {
                    path: 'author',
                    model: User,
                    select: "_id id name parentId image"
                },
                {
                    path: 'children',
                    model: Thread,
                    populate: {
                        path: 'author',
                        model: User,
                        select: "_id id name parentId image"
                    }
                }
            ]
        })
        .exec();
        return thread;
    }
    catch (error: any) {
        throw new Error(`Error fetching thread : ${error.message}`);
    }
}

export const addCommentToThread = async (
    threadId: string,
    commentText: string,
    userId: string,
    path: string
) => {
    connectToDB();

    try {
        const originalThread = await Thread.findById(threadId);

        if(!originalThread) {
            throw new Error("Thread not found");
        }

        const commentThread = new Thread({
            text: commentText,
            author: userId,
            parentId: threadId
        });

        const savedCommentThread = await commentThread.save();

        originalThread.children.push(savedCommentThread._id);
        await originalThread.save();
        revalidatePath(path);
    }
    catch(error: any) {
        throw new Error(`Error adding comment to thread: ${error.message}`);
    }
}
