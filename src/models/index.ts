/**
 * Model barrel — import models via "@/models/index.js" (or "./index.js").
 * Importing this file registers every schema exactly once (models/ guard
 * in each file makes tsx watch + tests safe).
 *
 * No DB connection is opened here; use config/db.ts connectDB() at boot.
 */
export { User, USER_ROLES, USER_STATUSES } from "./User.js";
export { Profile } from "./Profile.js";
export { Category } from "./Category.js";
export { Tag } from "./Tag.js";
export { Post, POST_STATUSES, POST_VISIBILITY } from "./Post.js";
export { Comment, COMMENT_STATUSES } from "./Comment.js";
export { Like } from "./Like.js";
export { Bookmark } from "./Bookmark.js";
export { Follow } from "./Follow.js";
export { Notification, NOTIFICATION_TYPES } from "./Notification.js";
export { Media, MEDIA_USAGES } from "./Media.js";
export { NewsletterSubscriber, SUBSCRIBER_STATUSES } from "./NewsletterSubscriber.js";
export { PostView } from "./PostView.js";
export { SiteSettings } from "./SiteSettings.js";
