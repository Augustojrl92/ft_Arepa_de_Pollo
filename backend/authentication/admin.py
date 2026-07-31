from django.contrib import admin

from .models import RegistrationInvite


@admin.register(RegistrationInvite)
class RegistrationInviteAdmin(admin.ModelAdmin):
	list_display = ('email', 'campus_login', 'note', 'created_by', 'created_at', 'used_at')
	list_filter = ('used_at',)
	search_fields = ('email', 'campus_login', 'note')
	readonly_fields = ('created_at', 'used_at')
	ordering = ('-created_at',)

	def save_model(self, request, obj, form, change):
		if obj.created_by is None:
			obj.created_by = request.user
		super().save_model(request, obj, form, change)
