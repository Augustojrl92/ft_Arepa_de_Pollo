from django.contrib import admin
from .models import CampusUser, Coalition

@admin.register(CampusUser)
class CampusUserAdmin(admin.ModelAdmin):
	list_display = (
		'login',
		'intra_id',
		'coalition_name',
		'coalition_user_score',
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
