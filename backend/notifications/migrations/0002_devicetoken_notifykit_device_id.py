from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="devicetoken",
            name="notifykit_device_id",
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
