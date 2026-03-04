from django.contrib.auth.models import Group, User
from rest_framework import serializers

# serializers are for convert datatypes like model instances or querystets into
# native datatypes such as dictionarios or lists whichc we can convert into JSONs

class UserSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = User
        fields = ["url", "username", "email", "groups"]

class GroupSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Group
        fields = ["url", "name"]
