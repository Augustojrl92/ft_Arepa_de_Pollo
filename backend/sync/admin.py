from django.contrib import admin
from .models import CampusUser, Coalition, CoalitionProjectCursor, CoalitionScoreSnapshot, CampusUserScoreSnapshot

@admin.register(CampusUser)
class CampusUserAdmin(admin.ModelAdmin):
	list_display = (
		'login',
		'intra_id',
		'coalition_name',
		'coalition_user_score',
		'projects_delivered_current_season',
		'projects_delivered_total',
		'level',
		'is_active',
	)
	list_filter = ('coalition_name', 'pool_month')
	search_fields = ('login', 'display_name', 'email', 'intra_id')
	ordering = ('-updated_at',)


@admin.register(Coalition)
class CoalitionAdmin(admin.ModelAdmin):
	list_display = ('name', 'coalition_id', 'total_score', 'updated_at')
	list_filter = ('name',)
	search_fields = ('name', 'slug', 'coalition_id')
	ordering = ('-total_score',)

@admin.register(CoalitionScoreSnapshot)
class CoalitionScoreSnapshotAdmin(admin.ModelAdmin):
	list_display = ('coalition', 'snapshot_date', 'total_score', 'campus_rank', 'captured_at')
	list_filter = ('coalition__name', 'snapshot_date')
	search_fields = ('coalition__name',)
	ordering = ('-snapshot_date',)


@admin.register(CoalitionProjectCursor)
class CoalitionProjectCursorAdmin(admin.ModelAdmin):
	list_display = ('coalition', 'last_score_id', 'last_score_created_at', 'last_synced_at')
	list_filter = ('coalition__name',)
	search_fields = ('coalition__name',)
	ordering = ('coalition__name',)

@admin.register(CampusUserScoreSnapshot)
class CampusUserScoreSnapshotAdmin(admin.ModelAdmin):
	list_display = ('campus_user', 'snapshot_date', 'coalition_user_score', 'coalition_user_rank', 'campus_user_rank', 'captured_at')
	list_filter = ('campus_user__login', 'snapshot_date')
	search_fields = ('campus_user__login',)
	ordering = ('-snapshot_date',)
