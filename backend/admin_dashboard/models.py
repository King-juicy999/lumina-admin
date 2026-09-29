from django.db import models


class Material(models.Model):
    course_code = models.CharField(max_length=20)
    course_title = models.CharField(max_length=200)
    faculty = models.CharField(max_length=50)
    department = models.CharField(max_length=50)
    program = models.CharField(max_length=50)
    level = models.PositiveSmallIntegerField()
    semester = models.CharField(max_length=10)
    session = models.CharField(max_length=9)
    material_type = models.CharField(max_length=30)
    file_hash = models.CharField(max_length=64, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_hidden = models.BooleanField(default=False)

    class Meta:
        managed = False
        db_table = 'materials_material'


class Download(models.Model):
    material = models.ForeignKey(Material, on_delete=models.CASCADE)
    downloaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'materials_download'


class MaterialRequest(models.Model):
    course_code = models.CharField(max_length=20)
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=10, default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'materials_materialrequest'
