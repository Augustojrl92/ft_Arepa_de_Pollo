from django.contrib import admin
from .models import Achievement, AchievementEvent, FriendsList, UserAchievementList

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

@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
	list_display = (
		'slug',
		'title',
		'description',
		'icon',
	)
	search_fields = ('slug', 'title', 'description')

@admin.register(UserAchievementList)
class UserAchievementListAdmin(admin.ModelAdmin):
	list_display = (
		'owner_username',
		'completed_count',
		'in_progress_count',
	)
	search_fields = ('owner__username', 'owner__email', 'owner__campus_user_profile__login')
	list_select_related = ('owner', 'owner__campus_user_profile')
	filter_horizontal = ('completed_achievements', 'in_progress_achievements')

	@admin.display(description='Username', ordering='owner__username')
	def owner_username(self, obj):
		return obj.owner.username

	@admin.display(description='Completed')
	def completed_count(self, obj):
		return obj.completed_achievements.count()

	@admin.display(description='In Progress')
	def in_progress_count(self, obj):
		return obj.in_progress_achievements.count()


@admin.register(AchievementEvent)
class AchievementEventAdmin(admin.ModelAdmin):
	list_display = (
		'owner_username',
		'achievement_title',
		'event_type',
		'created_at',
		'delivered_at',
	)
	search_fields = ('owner__username', 'owner__email', 'owner__campus_user_profile__login', 'achievement__slug', 'achievement__title', 'event_type')
	list_select_related = ('owner', 'achievement', 'owner__campus_user_profile')

	@admin.display(description='Username', ordering='owner__username')
	def owner_username(self, obj):
		return obj.owner.username

	@admin.display(description='Achievement', ordering='achievement__title')
	def achievement_title(self, obj):
		return obj.achievement.title