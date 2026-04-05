from django.contrib import admin
from .models import FriendsList

# Register your models here.

@admin.register(FriendsList)
class FriendsListAdmin(admin.ModelAdmin):
	list_display = (
		'owner_username',
		'friends_count',
		'pending_received_count',
		'pending_sent_count',
		'friends_preview',
	)
	search_fields = ('owner__username', 'owner__email', 'owner__campus_user_profile__login')
	list_select_related = ('owner', 'owner__campus_user_profile')
	filter_horizontal = ('friends', 'friends_requests_received', 'friends_requests_sent')

	def formfield_for_manytomany(self, db_field, request, **kwargs):
		if db_field.name in ('friends', 'friends_requests_received', 'friends_requests_sent'):
			object_id = None
			if request.resolver_match:
				object_id = request.resolver_match.kwargs.get('object_id')

			if object_id:
				kwargs['queryset'] = FriendsList.objects.exclude(pk=object_id).select_related('owner')

		return super().formfield_for_manytomany(db_field, request, **kwargs)

	@admin.display(description='Username', ordering='owner__username')
	def owner_username(self, obj):
		return obj.owner.username

	@admin.display(description='Friends')
	def friends_count(self, obj):
		return obj.friends.count()

	@admin.display(description='Pending Received')
	def pending_received_count(self, obj):
		return obj.friends_requests_received.count()

	@admin.display(description='Pending Sent')
	def pending_sent_count(self, obj):
		return obj.friends_requests_sent.count()

	@admin.display(description='Friends Preview')
	def friends_preview(self, obj):
		friend_usernames = list(obj.friends.select_related('owner').values_list('owner__username', flat=True)[:3])
		return ', '.join(friend_usernames) if friend_usernames else '-'