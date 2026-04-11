package com.altany.marioshelper;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Parcel;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import java.util.Date;

import expo.modules.notifications.notifications.model.NotificationRequest;
import expo.modules.notifications.notifications.presentation.builders.CategoryAwareNotificationBuilder;
import expo.modules.notifications.service.delegates.SharedPreferencesNotificationCategoriesStore;

/**
 * Receives a broadcast when a sticky notification is swiped away and immediately
 * re-posts it so the user must act on it via the action buttons.
 */
public class StickyNotificationReceiver extends BroadcastReceiver {
    public static final String ACTION = "com.altany.marioshelper.NOTIFICATION_DISMISSED";
    public static final String EXTRA_REQUEST_BYTES = "requestBytes";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION.equals(intent.getAction())) return;

        byte[] requestBytes = intent.getByteArrayExtra(EXTRA_REQUEST_BYTES);
        int notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0);

        if (requestBytes == null) {
            Log.e("StickyNotification", "No request bytes — cannot re-post");
            return;
        }

        try {
            // Unmarshal the original NotificationRequest
            Parcel parcel = Parcel.obtain();
            parcel.unmarshall(requestBytes, 0, requestBytes.length);
            parcel.setDataPosition(0);
            NotificationRequest request = NotificationRequest.CREATOR.createFromParcel(parcel);
            parcel.recycle();

            // Wrap in expo Notification model
            expo.modules.notifications.notifications.model.Notification expoNotification =
                new expo.modules.notifications.notifications.model.Notification(request, new Date());

            // Build using CategoryAwareNotificationBuilder so action buttons are included.
            // The patch in ExpoNotificationBuilder will automatically re-attach the deleteIntent,
            // making the re-posted notification equally sticky.
            SharedPreferencesNotificationCategoriesStore store =
                new SharedPreferencesNotificationCategoriesStore(context);
            CategoryAwareNotificationBuilder builder =
                new CategoryAwareNotificationBuilder(context, store);
            builder.setNotification(expoNotification);

            android.app.Notification notification = builder.build();

            if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
                NotificationManagerCompat.from(context).notify(notificationId, notification);
                Log.d("StickyNotification", "Re-posted notification id=" + notificationId);
            }
        } catch (Exception e) {
            Log.e("StickyNotification", "Failed to re-post notification", e);
        }
    }
}
